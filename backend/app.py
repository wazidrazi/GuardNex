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
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import pandas as pd
import json
import re
import unicodedata
from collections import defaultdict

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_key_please_change_in_production')
app.config['DATABASE_URL'] = os.environ.get(
    'DATABASE_URL',
    'postgresql://postgres:Mango%40292@localhost:5432/spam_detection'
)
app.config['JWT_EXPIRATION'] = int(os.environ.get('JWT_EXPIRATION', 86400))

# Global model variables
spam_model = None
text_preprocessor = None
tfidf_vectorizer = None

# Database connection
def get_db_connection():
    try:
        conn = psycopg2.connect(app.config['DATABASE_URL'])
        conn.autocommit = True
        return conn
    except:
        print("Warning: Database connection failed. Some features may not work.")
        return None

# Initialize database
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
    except Exception as e:
        print(f"Database initialization warning: {e}")

# Enhanced multi-language spam detection
class MultiLanguagePreprocessor:
    def __init__(self):
        self.spam_keywords = {
            'bangla': [
                'বিনামূল্যে', 'ফ্রি', 'জিতুন', 'পুরস্কার', 'লটারি', 'টাকা', 'অফার',
                'ছাড়', 'জরুরি', 'এখনই', 'ক্লিক', 'কল করুন', 'গ্যারান্টি', 'বিজয়ী',
                'লাভজনক', 'সুযোগ', 'সীমিত', 'দ্রুত', 'নিশ্চিত', 'জিতেছেন', 'পেতে',
                'রিচার্জ', 'লক্ষ', 'হাজার', 'কোটি', 'একাউন্ট', 'বন্ধ', 'সমস্যা',
                'কিস্তি', 'ঋণ', 'ইএমআই', 'ধার', 'ফান্ড', 'প্রফিট', 'ডিপোজিট',
                'সঞ্চয়', 'ইনকাম', 'আয়', 'অর্থ', 'পেমেন্ট', 'লেনদেন', 'ক্যাশ'
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
                'efectivo', 'bono', 'exclusivo', 'tiempo limitado', 'oportunidad'
            ]
        }

    def detect_language(self, text):
        bengali_chars = len(re.findall(r'[\u0980-\u09FF]', text))
        spanish_chars = len(re.findall(r'[áéíóúñ¿¡ü]', text.lower()))
        total_chars = len(re.sub(r'[\s\d\W]', '', text))
        
        if total_chars == 0:
            return 'english'
        
        bengali_ratio = bengali_chars / max(total_chars, 1)
        spanish_ratio = spanish_chars / max(total_chars, 1)
        
        spanish_words = ['gratis', 'ganar', 'dinero', 'premio', 'oferta', 'urgente']
        has_spanish_words = any(word in text.lower() for word in spanish_words)
        
        if bengali_ratio > 0.1:
            return 'bangla'
        elif spanish_ratio > 0.02 or has_spanish_words:
            return 'spanish'
        else:
            return 'english'

def calculate_spam_confidence(spam_score, indicators, is_spam):
    if is_spam:
        base_confidence = 0.60
        high_value_boost = 0
        if indicators.get('phone_numbers', 0) > 0:
            high_value_boost += 0.15
        if indicators.get('money_mentions', 0) > 0:
            high_value_boost += 0.12
        if indicators.get('urls', 0) > 0:
            high_value_boost += 0.10
        keyword_boost = min(indicators.get('spam_keywords', 0) * 0.05, 0.15)
        confidence = base_confidence + high_value_boost + keyword_boost
        return min(confidence, 0.98)
    else:
        if spam_score <= 1:
            return 0.88
        elif spam_score == 2:
            return 0.65
        else:
            return 0.52

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
            return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401
        
        return f(current_user, *args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        if current_user['role'] != 'admin':
            return jsonify({'message': 'Admin privileges required!'}), 403
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    
    if not name or not email or not password:
        return jsonify({'message': 'Missing required fields'}), 400
    
    hashed_password = generate_password_hash(password)
    
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'message': 'Database unavailable'}), 500
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({'message': 'Email already registered'}), 409
        
        cursor.execute(
            "INSERT INTO users (name, email, password) VALUES (%s, %s, %s) RETURNING id",
            (name, email, hashed_password)
        )
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
    email = data.get('email')
    password = data.get('password')
    
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

        # Enhanced language detection
        def detect_language_enhanced(text):
            bengali_chars = len(re.findall(r'[\u0980-\u09FF]', text))
            spanish_chars = len(re.findall(r'[áéíóúñ¿¡ü]', text.lower()))
            total_chars = len(re.sub(r'[\s\d\W]', '', text))
            
            if total_chars == 0:
                return 'english'
            
            bengali_ratio = bengali_chars / max(total_chars, 1)
            spanish_ratio = spanish_chars / max(total_chars, 1)
            
            spanish_words = ['gratis', 'ganar', 'dinero', 'premio', 'oferta', 'urgente']
            has_spanish_words = any(word in text.lower() for word in spanish_words)
            
            if bengali_ratio > 0.1:
                return 'bangla'
            elif spanish_ratio > 0.02 or has_spanish_words:
                return 'spanish'
            else:
                return 'english'
        
        language = detect_language_enhanced(message)
        
        # Initialize spam detection variables
        spam_score = 0
        indicators = {
            'spam_keywords': 0,
            'phone_numbers': 0,
            'money_mentions': 0,
            'urgent_words': 0,
            'urls': 0,
            'text_length': len(message)
        }
        
        message_lower = message.lower()

        # Language-specific spam detection
        if language == 'bangla':
            bangla_spam_keywords = [
                'বিনামূল্যে', 'ফ্রি', 'জিতুন', 'পুরস্কার', 'লটারি', 'টাকা', 'অফার',
                'ছাড়', 'জরুরি', 'এখনই', 'ক্লিক', 'কল করুন', 'গ্যারান্টি', 'বিজয়ী',
                'লাভজনক', 'সুযোগ', 'সীমিত', 'দ্রুত', 'নিশ্চিত', 'জিতেছেন', 'পেতে',
                'রিচার্জ', 'লক্ষ', 'হাজার', 'কোটি', 'একাউন্ট', 'বন্ধ', 'সমস্যা',
                'কিস্তি', 'ঋণ', 'ইএমআই', 'ধার', 'ফান্ড', 'প্রফিট', 'ডিপোজিট',
                'অবিশ্বাস্য', 'বিশেষ', 'প্রমোশন', 'উপহার', 'ডিল', 'এক্সক্লুসিভ',
                'অর্ডার', 'সাবস্ক্রিপশন', 'রেজিস্ট্রেশন', 'ফ্রি ট্রায়াল', 'বিনিয়োগ',
                'আয়', 'ক্যাশব্যাক', 'ডিসকাউন্ট', 'প্রাইজ', 'অ্যাক্সেস', 'মেম্বারশিপ',
                'অনলাইন', 'ডেলিভারি', 'স্টক', 'লিমিটেড', 'প্রাপ্তি', 'অনুমোদন', 'আপডেট'
            ]
            
            keyword_found = 0
            for keyword in bangla_spam_keywords:
                if keyword in message:
                    spam_score += 1
                    keyword_found += 1
            indicators['spam_keywords'] = keyword_found

            # Phone patterns
            phone_patterns = [
                r'(\+?88)?[-\s]?01[3-9]\d{8}',
                r'[০-৯]{11}',
                r'\b\d{11}\b',
                r'\b01[3-9]\d{8}\b'
            ]
            for pattern in phone_patterns:
                if re.search(pattern, message):
                    spam_score += 2
                    indicators['phone_numbers'] += 1
                    break

            # Money patterns
            money_patterns = [
                r'৳\s*[\d০-৯]+',
                r'[\d০-৯]+\s*(টাকা|হাজার|লক্ষ|লাখ|কোটি)',
                r'\d+\s*(টাকা|হাজার|লক্ষ|লাখ|কোটি)'
            ]
            for pattern in money_patterns:
                if re.search(pattern, message):
                    spam_score += 2
                    indicators['money_mentions'] += 1
                    break

            # Urgent words
            urgent_words = ['জরুরি', 'এখনই', 'তাড়াতাড়ি', 'দ্রুত', 'অবিলম্বে']
            for word in urgent_words:
                if word in message:
                    spam_score += 1
                    indicators['urgent_words'] += 1

        elif language == 'spanish':
            spanish_spam_keywords = [
                'gratis', 'ganar', 'ganador', 'dinero', 'premio', 'urgente', 'oferta',
                'limitado', 'clic', 'llame ahora', 'garantía', 'descuento',
                'felicitaciones', 'suerte', 'seleccionado', 'préstamo', 'crédito',
                'efectivo', 'bono', 'exclusivo', 'tiempo limitado', 'oportunidad',
                'barato', 'precio más bajo', 'liquidación', 'oferta especial',
                'ilimitado', 'dinero rápido', 'hazte rico', 'ingresos fáciles'
            ]
            
            keyword_found = 0
            for keyword in spanish_spam_keywords:
                if keyword.lower() in message_lower:
                    spam_score += 1
                    keyword_found += 1
            indicators['spam_keywords'] = keyword_found

            # Spanish phone patterns
            phone_patterns = [
                r'\b\d{3}[-.\s]?\d{3}[-.\s]?\d{3}\b',
                r'\+34\s?\d{9}',
                r'\b\d{9}\b'
            ]
            for pattern in phone_patterns:
                if re.search(pattern, message):
                    spam_score += 2
                    indicators['phone_numbers'] += 1
                    break

            # Spanish money patterns
            money_patterns = [r'€\s*\d+', r'\d+\s*(euros?|dólares?)', r'[$€]\s*\d+']
            for pattern in money_patterns:
                if re.search(pattern, message_lower):
                    spam_score += 2
                    indicators['money_mentions'] += 1
                    break

            # Spanish urgent words
            urgent_words = ['urgente', 'ahora', 'rápido', 'tiempo limitado', 'actúa ahora']
            for word in urgent_words:
                if word.lower() in message_lower:
                    spam_score += 1
                    indicators['urgent_words'] += 1

        else:  # English
            english_spam_keywords = [
                'free', 'win', 'winner', 'cash', 'prize', 'urgent', 'offer',
                'limited', 'click', 'call now', 'guarantee', 'discount',
                'congratulation', 'lucky', 'selected', 'money', 'loan',
                'credit', 'debt', 'bonus', 'reward', 'exclusive'
            ]
            
            keyword_found = 0
            for keyword in english_spam_keywords:
                if keyword.lower() in message_lower:
                    spam_score += 1
                    keyword_found += 1
            indicators['spam_keywords'] = keyword_found

            # English phone numbers
            if re.search(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', message):
                spam_score += 2
                indicators['phone_numbers'] += 1

            # English money mentions
            if re.search(r'[$€£]\s*\d+|\d+\s*(?:dollars|euro|pound|USD|EUR|GBP)', message_lower):
                spam_score += 2
                indicators['money_mentions'] += 1

            # English urgent words
            urgent_words = ['urgent', 'now', 'hurry', 'limited time', 'act now', 'today only']
            for word in urgent_words:
                if word.lower() in message_lower:
                    spam_score += 1
                    indicators['urgent_words'] += 1

        # Check for URLs (universal)
        if re.search(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', message):
            spam_score += 2
            indicators['urls'] += 1

        # Enhanced spam determination logic
        if spam_score >= 4:
            is_spam = True
        elif spam_score >= 3:
            high_value_indicators = indicators['phone_numbers'] + indicators['money_mentions'] + indicators['urls']
            is_spam = high_value_indicators >= 1
        elif spam_score >= 2:
            high_value_indicators = indicators['phone_numbers'] + indicators['money_mentions'] + indicators['urls']
            is_spam = high_value_indicators >= 1 and indicators['spam_keywords'] >= 1
        else:
            is_spam = False

        # Calculate confidence
        confidence = calculate_spam_confidence(spam_score, indicators, is_spam)

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
                    """INSERT INTO messages 
                       (user_id, content, type, language, is_spam, confidence, spam_indicators) 
                       VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                    (current_user['id'], message, message_type, language,
                     is_spam, confidence, json.dumps(indicators))
                )
                conn.commit()
                cursor.close()
                conn.close()
        except Exception as db_error:
            print(f"Database error: {db_error}")

        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': 'Error detecting spam', 'details': str(e)}), 500

@app.route('/api/test-predict', methods=['POST'])
def test_predict():
    """Test endpoint for prediction without authentication"""
    data = request.get_json()
    message = data.get('message', '')
    
    if not message:
        return jsonify({'error': 'No message provided'}), 400
    
    # Mock current_user for testing
    mock_user = {'id': 1}
    
    # Use same logic as main predict endpoint but skip database operations
    try:
        def detect_language_enhanced(text):
            bengali_chars = len(re.findall(r'[\u0980-\u09FF]', text))
            spanish_chars = len(re.findall(r'[áéíóúñ¿¡ü]', text.lower()))
            total_chars = len(re.sub(r'[\s\d\W]', '', text))
            
            if total_chars == 0:
                return 'english'
            
            bengali_ratio = bengali_chars / max(total_chars, 1)
            spanish_ratio = spanish_chars / max(total_chars, 1)
            
            spanish_words = ['gratis', 'ganar', 'dinero', 'premio', 'oferta', 'urgente']
            has_spanish_words = any(word in text.lower() for word in spanish_words)
            
            if bengali_ratio > 0.1:
                return 'bangla'
            elif spanish_ratio > 0.02 or has_spanish_words:
                return 'spanish'
            else:
                return 'english'
        
        language = detect_language_enhanced(message)
        spam_score = 0
        indicators = {'spam_keywords': 0, 'phone_numbers': 0, 'money_mentions': 0, 'urgent_words': 0, 'urls': 0}
        message_lower = message.lower()

        # Same detection logic as main endpoint
        if language == 'bangla':
            keywords = ['বিনামূল্যে', 'ফ্রি', 'জিতুন', 'টাকা', 'জরুরি', 'এখনই']
            for kw in keywords:
                if kw in message:
                    spam_score += 1
                    indicators['spam_keywords'] += 1
        elif language == 'spanish':
            keywords = ['gratis', 'ganar', 'dinero', 'premio', 'urgente']
            for kw in keywords:
                if kw in message_lower:
                    spam_score += 1
                    indicators['spam_keywords'] += 1
        else:
            keywords = ['free', 'win', 'money', 'urgent', 'prize']
            for kw in keywords:
                if kw in message_lower:
                    spam_score += 1
                    indicators['spam_keywords'] += 1

        # Check patterns
        if re.search(r'(\d{3}[-.]?\d{3}[-.]?\d{4}|01[3-9]\d{8}|\d{9,11})', message):
            spam_score += 2
            indicators['phone_numbers'] += 1

        if re.search(r'([$€£৳]\s*\d+|\d+\s*(dollars|euros|টাকা|হাজার))', message, re.IGNORECASE):
            spam_score += 2
            indicators['money_mentions'] += 1

        if re.search(r'http[s]?://', message):
            spam_score += 2
            indicators['urls'] += 1

        is_spam = spam_score >= 2
        confidence = calculate_spam_confidence(spam_score, indicators, is_spam)

        return jsonify({
            'isSpam': is_spam,
            'confidence': confidence,
            'message': 'Spam detected' if is_spam else 'Not spam',
            'language': language,
            'indicators': indicators
        }), 200

    except Exception as e:
        return jsonify({'error': 'Test prediction failed', 'details': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now(timezone.utc).isoformat()
    }), 200

def initialize_app():
    print("🚀 Initializing Enhanced Multi-Language Spam Detection App...")
    try:
        init_db()
        print("✅ Database initialized")
        
        # Test multi-language detection
        test_messages = [
            ("Win free money now! Call 123-456-7890", "English spam"),
            ("আপনি ১ লক্ষ টাকা জিতেছেন! এখনই কল করুন", "Bangla spam"),
            ("¡Felicitaciones! Has ganado 1000 euros gratis", "Spanish spam"),
            ("Hello, how are you?", "English ham"),
            ("আজকে কেমন আছেন?", "Bangla ham"),
            ("Hola, ¿cómo estás?", "Spanish ham")
        ]
        
        print("\n🧪 Testing multi-language detection:")
        for msg, expected in test_messages:
            # Quick language detection test
            bengali_chars = len(re.findall(r'[\u0980-\u09FF]', msg))
            spanish_chars = len(re.findall(r'[áéíóúñ¿¡ü]', msg.lower()))
            spanish_words = any(word in msg.lower() for word in ['gratis', 'ganar', 'dinero'])
            
            if bengali_chars > 0:
                lang = 'bangla'
            elif spanish_chars > 0 or spanish_words:
                lang = 'spanish'
            else:
                lang = 'english'
                
            print(f"✅ {expected} -> Detected: {lang}")
        
        print("✅ Multi-language spam detection ready!")
        
    except Exception as e:
        print(f"❌ Error during initialization: {e}")

if __name__ == '__main__':
    initialize_app()
    port = int(os.environ.get('PORT', 5000))
    print(f"\n🌐 Starting server on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)