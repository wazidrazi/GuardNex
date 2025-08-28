import os
from datetime import datetime, timezone, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import jwt.api_jwt as jwt
from functools import wraps
import psycopg2
from psycopg2.extras import RealDictCursor
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import pandas as pd
import json
import re
import unicodedata
import pickle
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_key_please_change_in_production')
app.config['DATABASE_URL'] = os.environ.get('DATABASE_URL', 'postgresql://postgres:Mango%40292@localhost:5432/spam_detection')
app.config['JWT_EXPIRATION'] = int(os.environ.get('JWT_EXPIRATION', 86400))

spam_models = {}
vectorizers = {}
model_trained = False

def get_db_connection():
    try:
        conn = psycopg2.connect(app.config['DATABASE_URL'])
        conn.autocommit = True
        return conn
    except Exception as e:
        logger.warning(f"Database connection failed: {e}")
        return None

def init_db():
    try:
        conn = get_db_connection()
        if not conn:
            return
        cursor = conn.cursor()
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            content TEXT NOT NULL,
            type VARCHAR(20) NOT NULL,
            language VARCHAR(10) DEFAULT 'unknown',
            is_spam BOOLEAN NOT NULL,
            confidence FLOAT NOT NULL,
            spam_indicators JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        cursor.execute("SELECT * FROM users WHERE email = 'admin@example.com'")
        admin = cursor.fetchone()
        
        if not admin:
            admin_password = generate_password_hash('admin123')
            cursor.execute(
                "INSERT INTO users (name, email, password, role) VALUES (%s, %s, %s, %s)",
                ('Admin User', 'admin@example.com', admin_password, 'admin')
            )
        
        conn.commit()
        cursor.close()
        conn.close()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")

class MultiLanguagePreprocessor:
    def __init__(self):
        self.spam_keywords = {
            'bangla': [
                'বিনামূল্যে', 'ফ্রি', 'জিতুন', 'পুরস্কার', 'লটারি', 'টাকা', 'অফার',
                'ছাড়', 'জরুরি', 'এখনই', 'ক্লিক', 'কল করুন', 'গ্যারান্টি', 'বিজয়ী',
                'লাভজনক', 'সুযোগ', 'সীমিত', 'দ্রুত', 'নিশ্চিত', 'জিতেছেন', 'পেতে',
                'রিচার্জ', 'লক্ষ', 'হাজার', 'কোটি', 'একাউন্ট', 'বন্ধ', 'সমস্যা'
            ],
            'english': [
                'free', 'win', 'winner', 'cash', 'prize', 'urgent', 'offer',
                'limited', 'click', 'call now', 'guarantee', 'discount',
                'congratulation', 'lucky', 'selected', 'money', 'loan',
                'credit', 'debt', 'income', 'profit', 'bonus', 'reward',
                'exclusive', 'limited time', 'act now', 'hurry', 'today only'
            ],
            'spanish': [
                'gratis', 'ganar', 'ganador', 'dinero', 'premio', 'urgente', 'oferta',
                'limitado', 'clic', 'llame ahora', 'garantía', 'descuento',
                'felicitaciones', 'suerte', 'seleccionado', 'préstamo', 'crédito',
                'efectivo', 'bono', 'exclusivo', 'tiempo limitado', 'oportunidad',
                'euros', 'dólares', 'promoción', 'sorteo', 'lotería', 'gratuito',
                'llamar', 'teléfono', 'contactar', 'inmediatamente', 'rápidamente'
            ]
        }

    def detect_language(self, text):
        text_lower = text.lower()
        
        bengali_chars = len(re.findall(r'[\u0980-\u09FF]', text))
        spanish_chars = len(re.findall(r'[áéíóúñüÁÉÍÓÚÑÜ¿¡àèìòù]', text))
        total_chars = len(re.sub(r'[\s\d\W]', '', text))
        
        if total_chars == 0:
            return 'english'
        
        bengali_ratio = bengali_chars / max(total_chars, 1)
        spanish_ratio = spanish_chars / max(total_chars, 1)
        
        spanish_indicators = [
            'gratis', 'ganar', 'dinero', 'premio', 'oferta', 'urgente', 'garantía',
            'descuento', 'felicitaciones', 'euros', 'dólares', 'hola', 'cómo',
            'qué', 'sí', 'muy', 'bien', 'gracias', 'usted', 'señor', 'ahora'
        ]
        spanish_word_count = sum(1 for word in spanish_indicators if word in text_lower)
        has_spanish_punctuation = bool(re.search(r'[¿¡]', text))
        
        if bengali_ratio > 0.1:
            return 'bangla'
        elif (spanish_ratio > 0.01 or spanish_word_count >= 1 or has_spanish_punctuation or
              any(word in text_lower for word in ['gratis', 'ganar', 'dinero', 'euros'])):
            return 'spanish'
        else:
            return 'english'

    def preprocess_text(self, text, language):
        text = text.lower().strip()
        text = re.sub(r'\s+', ' ', text)
        
        if language == 'bangla':
            text = re.sub(r'[a-zA-Z0-9]+', ' ', text)
        elif language == 'spanish':
            text = unicodedata.normalize('NFC', text)
            text = re.sub(r'[^\w\sáéíóúñü¿¡àèìòù]', ' ', text)
        elif language == 'english':
            text = re.sub(r'[^\x00-\x7F]+', ' ', text)
        
        return re.sub(r'\s+', ' ', text).strip()

def load_training_data():
    datasets = []
    
    dataset_configs = {
        'emails.csv': {
            'text_cols': ['text', 'message', 'email', 'content', 'body', 'v2'],
            'label_cols': ['label', 'spam', 'category', 'class', 'v1']
        },
        'Bangla_Email_Dataset.csv': {
            'text_cols': ['text', 'message', 'email', 'content', 'body'],
            'label_cols': ['label', 'spam', 'category', 'class']
        },
        'Dataset_5971.csv': {
            'text_cols': ['text', 'message', 'email', 'content', 'body'],
            'label_cols': ['label', 'spam', 'category', 'class']
        },
        'spanish_spam.csv': {
            'text_cols': ['text', 'message', 'email', 'content', 'texto', 'mensaje'],
            'label_cols': ['label', 'spam', 'category', 'class', 'etiqueta']
        }
    }
    
    preprocessor = MultiLanguagePreprocessor()
    
    for filename, config in dataset_configs.items():
        if os.path.exists(filename):
            try:
                logger.info(f"Loading {filename}...")
                
                for encoding in ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']:
                    try:
                        df = pd.read_csv(filename, encoding=encoding)
                        break
                    except UnicodeDecodeError:
                        continue
                else:
                    continue
                
                text_col = next((col for col in config['text_cols'] if col in df.columns), None)
                label_col = next((col for col in config['label_cols'] if col in df.columns), None)
                
                if text_col and label_col:
                    df = df.dropna(subset=[text_col, label_col])
                    df[label_col] = df[label_col].astype(str).str.lower().str.strip()
                    
                    def map_label(label):
                        if label in ['spam', '1', 'yes', 'true', 'si']:
                            return 1
                        elif label in ['ham', '0', 'no', 'false']:
                            return 0
                        return None
                    
                    df['is_spam'] = df[label_col].apply(map_label)
                    df = df.dropna(subset=['is_spam'])
                    df['detected_language'] = df[text_col].apply(preprocessor.detect_language)
                    
                    for _, row in df.iterrows():
                        if isinstance(row[text_col], str) and len(row[text_col].strip()) > 0:
                            datasets.append({
                                'text': row[text_col],
                                'label': int(row['is_spam']),
                                'language': row['detected_language'],
                                'source': filename
                            })
                    
                    logger.info(f"Loaded {len(df)} samples from {filename}")
                    
            except Exception as e:
                logger.error(f"Error loading {filename}: {e}")
    
    if not datasets:
    # Fallback synthetic data
        synthetic_data = [
            # English spam
            ("Win $1000 cash now! Call 555-0123!", 1, 'english'),
            ("FREE MONEY! Click here now!", 1, 'english'),
            ("Congratulations! You are the lucky winner of a free vacation.", 1, 'english'),
            ("Exclusive deal: Buy one get one free. Limited time!", 1, 'english'),
            ("Claim your bonus reward instantly!", 1, 'english'),

            # English ham
            ("Hello, how are you today?", 0, 'english'),
            ("Meeting at 3pm tomorrow", 0, 'english'),
            ("Don't forget to bring your laptop to the office.", 0, 'english'),
            ("Happy Birthday! Wishing you a wonderful day.", 0, 'english'),

            # Bangla spam
            ("আপনি ১ লক্ষ টাকা জিতেছেন! কল করুন", 1, 'bangla'),
            ("বিনামূল্যে টাকা পেতে ক্লিক করুন!", 1, 'bangla'),
            ("শুধুমাত্র আজ! বিশেষ অফার শেষ হয়ে যাচ্ছে।", 1, 'bangla'),
            ("ফ্রি বোনাস পেতে এখনই লগইন করুন।", 1, 'bangla'),
            ("আপনার মোবাইল নম্বর লটারি জিতেছে!", 1, 'bangla'),

            # Bangla ham
            ("আজকে কেমন আছেন?", 0, 'bangla'),
            ("আগামীকাল ক্লাস সকাল ১০টায় শুরু হবে।", 0, 'bangla'),
            ("আমি আজকে বই কিনতে গিয়েছিলাম।", 0, 'bangla'),
            ("আমরা সন্ধ্যায় একসাথে দেখা করব।", 0, 'bangla'),

            # Spanish spam
            ("¡Felicitaciones! Has ganado 1000 euros gratis", 1, 'spanish'),
            ("Dinero gratis ahora! Haz clic aquí", 1, 'spanish'),
            ("Oferta exclusiva: gana dinero rápido sin esfuerzo.", 1, 'spanish'),
            ("Trabaja desde casa y recibe $2000 cada semana.", 1, 'spanish'),
            ("Lotería garantizada, reclama tu premio ahora!", 1, 'spanish'),

            # Spanish ham
            ("Hola, ¿cómo estás?", 0, 'spanish'),
            ("Nos vemos mañana en la reunión.", 0, 'spanish'),
            ("Feliz cumpleaños! Que tengas un gran día.", 0, 'spanish'),
            ("El clima hoy está muy agradable.", 0, 'spanish'),
        ]

    for text, label, lang in synthetic_data:
        datasets.append({'text': text, 'label': label, 'language': lang, 'source': 'synthetic'})

    return pd.DataFrame(datasets)

def train_models():
    global spam_models, vectorizers, model_trained
    
    data = load_training_data()
    if data.empty:
        return False
    
    logger.info(f"Training with {len(data)} samples")
    preprocessor = MultiLanguagePreprocessor()
    
    for language in data['language'].unique():
        lang_data = data[data['language'] == language]
        if len(lang_data) < 4:
            continue
        
        texts = [preprocessor.preprocess_text(text, language) for text in lang_data['text']]
        labels = lang_data['label'].values
        
        vectorizer = TfidfVectorizer(max_features=3000, ngram_range=(1, 2), min_df=1, max_df=0.9)
        
        try:
            X = vectorizer.fit_transform(texts)
            if len(lang_data) >= 8:
                X_train, X_test, y_train, y_test = train_test_split(X, labels, test_size=0.2, random_state=42, stratify=labels)
            else:
                X_train, X_test, y_train, y_test = X, X, labels, labels
            
            model = MultinomialNB(alpha=0.1)
            model.fit(X_train, y_train)
            
            accuracy = accuracy_score(y_test, model.predict(X_test))
            logger.info(f"{language} model accuracy: {accuracy:.3f}")
            
            spam_models[language] = model
            vectorizers[language] = vectorizer
            
        except Exception as e:
            logger.error(f"Error training {language}: {e}")
    
    if spam_models:
        model_trained = True
        os.makedirs('models', exist_ok=True)
        for lang in spam_models:
            with open(f'models/{lang}_model.pkl', 'wb') as f:
                pickle.dump(spam_models[lang], f)
            with open(f'models/{lang}_vectorizer.pkl', 'wb') as f:
                pickle.dump(vectorizers[lang], f)
        return True
    return False

def predict_with_ml_model(text, language):
    if not model_trained or language not in spam_models:
        return None, 0.5
    
    try:
        preprocessor = MultiLanguagePreprocessor()
        processed_text = preprocessor.preprocess_text(text, language)
        if not processed_text.strip():
            return None, 0.5
        
        X = vectorizers[language].transform([processed_text])
        prediction = spam_models[language].predict(X)[0]
        probabilities = spam_models[language].predict_proba(X)[0]
        
        return bool(prediction), max(probabilities)
    except Exception as e:
        logger.error(f"ML prediction error: {e}")
        return None, 0.5

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            data = jwt.decode(jwt=token, key=app.config['SECRET_KEY'], algorithms=["HS256"])
            conn = get_db_connection()
            if not conn:
                return jsonify({'message': 'Database unavailable'}), 500
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("SELECT * FROM users WHERE id = %s", (data['user_id'],))
            current_user = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if not current_user:
                return jsonify({'message': 'User no longer exists!'}), 401
        except Exception as e:
            return jsonify({'message': 'Token is invalid!'}), 401
        
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    name, email, password = data.get('name'), data.get('email'), data.get('password')
    
    if not all([name, email, password]):
        return jsonify({'message': 'Missing required fields'}), 400
    
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'message': 'Database unavailable'}), 500
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({'message': 'Email already registered'}), 409
        
        hashed_password = generate_password_hash(password)
        cursor.execute("INSERT INTO users (name, email, password) VALUES (%s, %s, %s) RETURNING id", (name, email, hashed_password))
        user_id = cursor.fetchone()[0]
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'User registered successfully', 'user_id': user_id}), 201
    except Exception as e:
        return jsonify({'message': 'Registration failed', 'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email, password = data.get('email'), data.get('password')
    
    if not email or not password:
        return jsonify({'message': 'Missing email or password'}), 400
    
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'message': 'Database unavailable'}), 500
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not user or not check_password_hash(user['password'], password):
            return jsonify({'message': 'Invalid credentials'}), 401
        
        token_payload = {
            'user_id': user['id'],
            'email': user['email'],
            'role': user['role'],
            'exp': datetime.now(timezone.utc) + timedelta(seconds=app.config['JWT_EXPIRATION'])
        }
        
        token = jwt.encode(payload=token_payload, key=app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({
            'token': token,
            'user': {
                'id': user['id'],
                'name': user['name'],
                'email': user['email'],
                'role': user['role']
            }
        }), 200
    except Exception as e:
        return jsonify({'message': 'Login failed', 'error': str(e)}), 500

@app.route('/api/predict', methods=['POST'])
@token_required
def predict_spam(current_user):
    try:
        data = request.get_json()
        if not data or not data.get('message'):
            return jsonify({'error': 'No message provided'}), 400
            
        message = data.get('message')
        message_type = data.get('type', 'email')

        preprocessor = MultiLanguagePreprocessor()
        language = preprocessor.detect_language(message)
        
        indicators = {
            'spam_keywords': 0,
            'phone_numbers': 0,
            'money_mentions': 0,
            'urgent_words': 0,
            'urls': 0,
            'text_length': len(message)
        }
        
        spam_score = 0
        message_lower = message.lower()

        # Get ML prediction
        ml_prediction, ml_confidence = predict_with_ml_model(message, language)
        
        # Rule-based indicators
        spam_keywords = preprocessor.spam_keywords.get(language, [])
        for keyword in spam_keywords:
            if keyword.lower() in message_lower:
                spam_score += 1
                indicators['spam_keywords'] += 1

        # Phone patterns
        phone_patterns = {
            'bangla': [r'(\+?88)?[-\s]?01[3-9]\d{8}', r'\b\d{11}\b'],
            'spanish': [r'\+34\s?\d{9}', r'\b\d{9}\b', r'\b6\d{8}\b'],
            'english': [r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b']
        }
        
        for pattern in phone_patterns.get(language, []):
            if re.search(pattern, message):
                spam_score += 2
                indicators['phone_numbers'] += 1
                break

        # Money patterns
        money_patterns = {
            'bangla': [r'৳\s*[\d০-৯]+', r'[\d০-৯]+\s*(টাকা|হাজার|লক্ষ|কোটি)'],
            'spanish': [r'€\s*\d+', r'\d+\s*euros?', r'\d+\s*dólares?'],
            'english': [r'[$€£]\s*\d+', r'\d+\s*(?:dollars|euro|pound)']
        }
        
        for pattern in money_patterns.get(language, []):
            if re.search(pattern, message_lower):
                spam_score += 2
                indicators['money_mentions'] += 1
                break

        # Urgent words
        urgent_words = {
            'bangla': ['জরুরি', 'এখনই', 'তাড়াতাড়ি', 'দ্রুত'],
            'spanish': ['urgente', 'ahora', 'rápido', 'inmediatamente'],
            'english': ['urgent', 'now', 'hurry', 'immediately']
        }
        
        for word in urgent_words.get(language, []):
            if word.lower() in message_lower:
                spam_score += 1
                indicators['urgent_words'] += 1

        # URLs
        if re.search(r'http[s]?://\S+', message):
            spam_score += 2
            indicators['urls'] += 1

        # Final decision
        if ml_prediction is not None:
            is_spam = ml_prediction
            confidence = ml_confidence
        else:
            is_spam = spam_score >= 3
            confidence = 0.85 if is_spam else 0.75

        result = {
            'isSpam': is_spam,
            'confidence': confidence,
            'message': 'Spam detected' if is_spam else 'Not spam',
            'language': language,
            'indicators': indicators
        }

        # Save to database
        try:
            conn = get_db_connection()
            if conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO messages (user_id, content, type, language, is_spam, confidence, spam_indicators) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (current_user['id'], message, message_type, language, is_spam, confidence, json.dumps(indicators))
                )
                conn.commit()
                cursor.close()
                conn.close()
        except Exception as db_error:
            logger.error(f"Database error: {db_error}")

        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': 'Error detecting spam', 'details': str(e)}), 500

@app.route('/api/test-predict', methods=['POST'])
def test_predict():
    data = request.get_json()
    message = data.get('message', '')
    
    if not message:
        return jsonify({'error': 'No message provided'}), 400
    
    try:
        preprocessor = MultiLanguagePreprocessor()
        language = preprocessor.detect_language(message)
        
        ml_prediction, ml_confidence = predict_with_ml_model(message, language)
        
        # Simple rule-based fallback
        spam_score = 0
        spam_keywords = preprocessor.spam_keywords.get(language, [])
        for keyword in spam_keywords:
            if keyword.lower() in message.lower():
                spam_score += 1
        
        if re.search(r'\d{3,}', message):  # Phone/money numbers
            spam_score += 2
        
        if ml_prediction is not None:
            is_spam = ml_prediction
            confidence = ml_confidence
        else:
            is_spam = spam_score >= 2
            confidence = 0.8 if is_spam else 0.7

        return jsonify({
            'isSpam': is_spam,
            'confidence': confidence,
            'message': 'Spam detected' if is_spam else 'Not spam',
            'language': language,
            'indicators': {'spam_keywords': spam_score}
        }), 200

    except Exception as e:
        return jsonify({'error': 'Test prediction failed', 'details': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'models_trained': model_trained,
        'available_languages': list(spam_models.keys()) if model_trained else []
    }), 200

def initialize_app():
    print("🚀 Initializing Enhanced Multi-Language Spam Detection App...")
    try:
        init_db()
        print("✅ Database initialized")
        
        # Try to load existing models or train new ones
        if not train_models():
            print("⚠️  No models trained, using rule-based detection only")
        else:
            print("✅ ML models trained successfully")
        
        print("✅ Multi-language spam detection ready!")
        
    except Exception as e:
        print(f"❌ Error during initialization: {e}")

if __name__ == '__main__':
    initialize_app()
    port = int(os.environ.get('PORT', 5000))
    print(f"\n🌐 Starting server on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)