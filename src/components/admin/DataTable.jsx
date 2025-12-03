import { useState, useEffect, useMemo } from "react";
import {
  Search,
  X,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Archive,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const DataTable = ({
  data = [],
  columns = [],
  title,
  description = null,
  searchable = true,
  pagination = true,
  selectable = false,
  itemsPerPageOptions = [10, 25, 50, 100],
  initialItemsPerPage = 10,
  actions = null,
  refreshData = null,
  loading = false,
  emptyMessage = "No data available",
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });
  const [selectedRows, setSelectedRows] = useState([]);
  const [allSelected, setAllSelected] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (!searchTerm.trim()) return true;

      return columns.some((column) => {
        const value = item[column.accessor];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(searchTerm.toLowerCase());
      });
    });
  }, [data, columns, searchTerm]);

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (sortConfig.direction === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    });
  }, [filteredData, sortConfig]);

  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const currentItems = useMemo(() => {
    const end = currentPage * itemsPerPage;
    const start = end - itemsPerPage;
    return sortedData.slice(start, end);
  }, [sortedData, currentPage, itemsPerPage]);

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const toggleRowSelection = (rowIndex) => {
    setSelectedRows((prev) => {
      if (prev.includes(rowIndex)) {
        return prev.filter((i) => i !== rowIndex);
      }
      return [...prev, rowIndex];
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedRows([]);
    } else {
      setSelectedRows(currentItems.map((_, idx) => idx));
    }
    setAllSelected(!allSelected);
  };

  useEffect(() => {
    setSelectedRows([]);
    setAllSelected(false);
  }, [currentPage, itemsPerPage]);

  const getSortIcon = (columnAccessor) => {
    if (sortConfig.key !== columnAccessor) {
      return (
        <ChevronsUpDown className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      );
    }
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="w-4 h-4 text-blue-600" />
    ) : (
      <ChevronDown className="w-4 h-4 text-blue-600" />
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* HEADER */}
      <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-gray-600">{description}</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {searchable && (
              <div className="relative group">
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  className="pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}

            {refreshData && (
              <button
                onClick={refreshData}
                disabled={loading}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            )}

            {actions}
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {selectable && (
                <th className="pl-6 pr-3 py-4 w-12">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}

              {columns.map((column) => (
                <th
                  key={column.accessor}
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                >
                  <div
                    className={`flex items-center gap-2 ${
                      column.sortable !== false ? "cursor-pointer group" : ""
                    }`}
                    onClick={() =>
                      column.sortable !== false && requestSort(column.accessor)
                    }
                  >
                    {column.Header}
                    {column.sortable !== false && getSortIcon(column.accessor)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="py-16 text-center"
                >
                  <RefreshCw className="mx-auto h-10 w-10 animate-spin text-blue-600 mb-2" />
                  <p className="text-gray-600 text-sm">Loading...</p>
                </td>
              </tr>
            ) : currentItems.length > 0 ? (
              currentItems.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={`${
                    selectedRows.includes(rowIndex)
                      ? "bg-blue-50 border-l-4 border-blue-500"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {selectable && (
                    <td className="pl-6 pr-3 py-4">
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(rowIndex)}
                        onChange={() => toggleRowSelection(rowIndex)}
                        className="w-4 h-4"
                      />
                    </td>
                  )}

                  {columns.map((column, colIndex) => (
                    <td key={colIndex} className="px-6 py-4 text-sm">
                      {column.Cell
                        ? column.Cell({
                            value: row[column.accessor],
                            row,
                          })
                        : row[column.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="py-16 text-center bg-gray-50"
                >
                  <Archive className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <p className="font-semibold text-gray-900">
                    {searchTerm ? "No results found" : emptyMessage}
                  </p>
                  <p className="text-sm text-gray-500">
                    {searchTerm
                      ? "Try different keywords"
                      : "Add some data to get started"}
                  </p>

                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="mt-4 px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                    >
                      <X className="h-4 w-4 inline mr-1" />
                      Clear search
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {pagination && totalItems > 0 && (
        <div className="bg-gray-50 px-4 py-4 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-600">
            Showing <b>{startItem}</b>–<b>{endItem}</b> of <b>{totalItems}</b>{" "}
            results
          </div>

          <div className="flex items-center gap-4">
            <select
              className="border rounded-lg px-3 py-1.5 text-sm"
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              {itemsPerPageOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-2 border rounded-lg disabled:opacity-40"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border rounded-lg disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* PAGE NUMBERS */}
              {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                let pageNum;

                if (totalPages <= 5) {
                  pageNum = idx + 1;
                } else if (currentPage <= 3) {
                  pageNum = idx + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + idx;
                } else {
                  pageNum = currentPage - 2 + idx;
                }

                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-2 rounded-lg text-sm border ${
                      pageNum === currentPage
                        ? "bg-blue-600 text-white border-blue-600"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="p-2 border rounded-lg disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 border rounded-lg disabled:opacity-40"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
