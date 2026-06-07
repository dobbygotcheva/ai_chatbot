"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface DataTableFilterField<TData> {
  label: string;
  value: keyof TData;
  placeholder?: string;
}

export interface DataTablePaginationResponse<TData> {
  data: TData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DataTableProps<TData, TValue> {
  /**
   * API endpoint to fetch data from
   * Will be called with: page, pageSize, search, sort, filters
   */
  endpoint: string;

  /**
   * Column definitions
   */
  columns: ColumnDef<TData, TValue>[];

  /**
   * Optional search configuration
   */
  searchField?: DataTableFilterField<TData>;

  /**
   * Default page size
   */
  defaultPageSize?: number;

  /**
   * Page size options
   */
  pageSizeOptions?: number[];

  /**
   * Custom query parameters to include in API requests
   */
  queryParams?: Record<string, string | number | boolean>;

  /**
   * Transform API response to match expected format
   */
  transformResponse?: (response: unknown) => DataTablePaginationResponse<TData>;

  /**
   * Custom empty state
   */
  emptyState?: React.ReactNode;

  /**
   * Loading state content
   */
  loadingState?: React.ReactNode;

  /**
   * Error state content
   */
  errorState?: React.ReactNode;

  /**
   * Additional actions to render above the table
   */
  actions?: React.ReactNode;

  /**
   * Enable row selection
   */
  enableRowSelection?: boolean;

  /**
   * Enable column sorting
   */
  enableSorting?: boolean;

  /**
   * Enable column filters
   */
  enableFilters?: boolean;

  /**
   * Manual pagination (server-side)
   */
  manualPagination?: boolean;

  /**
   * Manual sorting (server-side)
   */
  manualSorting?: boolean;

  /**
   * Manual filtering (server-side)
   */
  manualFiltering?: boolean;

  /**
   * Refresh trigger
   */
  refreshTrigger?: number;
}

export function DataTable<TData, TValue>({
  endpoint,
  columns,
  searchField,
  defaultPageSize = 10,
  pageSizeOptions = [10, 20, 50, 100],
  queryParams = {},
  transformResponse,
  emptyState,
  loadingState,
  errorState,
  actions,
  enableRowSelection = false,
  enableSorting = true,
  enableFilters = true,
  manualPagination = true,
  manualSorting = true,
  manualFiltering = true,
  refreshTrigger = 0,
}: DataTableProps<TData, TValue>) {
  const [data, setData] = useState<TData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  // Memoize queryParams and transformResponse to prevent infinite re-renders
  const queryParamsString = useMemo(
    () => JSON.stringify(queryParams),
    [queryParams]
  );

  const transformResponseFn = useCallback(
    (response: unknown) => {
      return transformResponse ? transformResponse(response) : response;
    },
    [transformResponse]
  );

  // Fetch data when pagination, sorting, or filters change
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();

        // Pagination
        params.set("page", String(pagination.pageIndex + 1)); // API uses 1-based indexing
        params.set("pageSize", String(pagination.pageSize));

        // Sorting
        if (sorting.length > 0) {
          params.set("sortField", String(sorting[0].id));
          params.set("sortOrder", sorting[0].desc ? "desc" : "asc");
        }

        // Search
        if (globalFilter) {
          params.set("search", globalFilter);
        }

        // Column filters
        columnFilters.forEach((filter) => {
          params.set(String(filter.id), String(filter.value));
        });

        // Custom query params
        if (queryParams) {
          Object.entries(queryParams).forEach(([key, value]) => {
            params.set(key, String(value));
          });
        }

        const response = await fetch(`${endpoint}?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseData = await response.json();

        // Transform response if needed
        const transformedData = transformResponseFn(responseData) as DataTablePaginationResponse<TData>;

        setData(transformedData.data);
        setTotal(transformedData.total);
        setTotalPages(transformedData.totalPages);
        setHasLoadedData(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    endpoint,
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    globalFilter,
    columnFilters,
    queryParamsString,
    transformResponseFn,
    refreshTrigger,
  ]);

  const table = useReactTable({
    data,
    columns,
    state: {
      pagination,
      sorting,
      columnFilters,
      globalFilter,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination,
    manualSorting,
    manualFiltering,
    pageCount: manualPagination ? totalPages : undefined,
    enableRowSelection,
    enableSorting,
    enableSortingRemoval: false,
  });

  const showInitialLoading = loading && !hasLoadedData;
  const showBlockingError = error && !hasLoadedData;
  const isRefreshing = loading && hasLoadedData;

  // Default loading state
  const defaultLoadingState = (
    <div className="flex h-48 items-center justify-center">
      <div className="text-center">
        <div className="text-lg font-medium">Loading data...</div>
        <p className="text-muted-foreground text-sm">Please wait</p>
      </div>
    </div>
  );

  // Default error state
  const defaultErrorState = (
    <div className="flex h-48 items-center justify-center">
      <div className="text-center">
        <div className="text-lg font-medium text-red-600">Error loading data</div>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    </div>
  );

  // Default empty state
  const defaultEmptyState = (
    <div className="flex h-48 items-center justify-center">
      <div className="text-center">
        <div className="text-lg font-medium">No results found</div>
        <p className="text-muted-foreground text-sm">
          Try adjusting your search or filters
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          {searchField && enableFilters && (
            <Input
              placeholder={`Search ${searchField.label.toLowerCase()}...`}
              value={globalFilter ?? ""}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="h-9 w-full max-w-sm"
            />
          )}
          {actions}
        </div>
        <Select
          value={String(pagination.pageSize)}
          onValueChange={(value) => {
            setPagination({
              pageIndex: 0,
              pageSize: Number(value),
            });
          }}
        >
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue placeholder="Page size" />
          </SelectTrigger>
          <SelectContent side="top">
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                className="border-b hover:bg-transparent"
                key={headerGroup.id}
              >
                {headerGroup.headers.map((header) => {
                  const meta = (header.column.columnDef.meta ?? {}) as {
                    align?: "left" | "right" | "center";
                    headerClassName?: string;
                  };
                  const isRight = meta.align === "right";
                  const isCenter = meta.align === "center";

                  if (header.isPlaceholder) {
                    return (
                      <TableHead
                        className={cn(
                          "h-11",
                          isRight && "text-right",
                          isCenter && "text-center"
                        )}
                        key={header.id}
                      />
                    );
                  }

                  const headerContent = flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  );

                  const headClassName = cn(
                    "h-11 whitespace-nowrap font-semibold text-foreground/80",
                    isRight && "text-right",
                    isCenter && "text-center",
                    meta.headerClassName
                  );

                  if (!header.column.getCanSort()) {
                    return (
                      <TableHead className={headClassName} key={header.id}>
                        {headerContent}
                      </TableHead>
                    );
                  }

                  const sortDir = header.column.getIsSorted();
                  const SortIcon =
                    sortDir === "asc"
                      ? ArrowUp
                      : sortDir === "desc"
                        ? ArrowDown
                        : ArrowUpDown;
                  const isSorted = sortDir !== false;

                  return (
                    <TableHead className={headClassName} key={header.id}>
                      <button
                        aria-label={`Sort by ${header.column.id}`}
                        className={cn(
                          "-mx-2 inline-flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-md px-2 font-semibold transition-colors hover:bg-accent hover:text-foreground",
                          isSorted
                            ? "text-foreground"
                            : "text-muted-foreground"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                        type="button"
                      >
                        {headerContent}
                        <SortIcon
                          className={cn(
                            "size-3.5 transition-opacity",
                            isSorted ? "opacity-100" : "opacity-40"
                          )}
                        />
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {showInitialLoading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  className="h-48 text-center"
                  colSpan={columns.length}
                >
                  {loadingState ?? defaultLoadingState}
                </TableCell>
              </TableRow>
            ) : showBlockingError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  className="h-48 text-center"
                  colSpan={columns.length}
                >
                  {errorState ?? defaultErrorState}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  className="border-b last:border-b-0"
                  data-state={row.getIsSelected() && "selected"}
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = (cell.column.columnDef.meta ?? {}) as {
                      align?: "left" | "right" | "center";
                      cellClassName?: string;
                    };
                    return (
                      <TableCell
                        className={cn(
                          "py-3",
                          meta.align === "right" && "text-right",
                          meta.align === "center" && "text-center",
                          meta.cellClassName
                        )}
                        key={cell.id}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  className="h-48 text-center"
                  colSpan={columns.length}
                >
                  {emptyState ?? defaultEmptyState}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">
            {total > 0 ? (
              <>
                Showing{" "}
                <span className="font-medium text-foreground">
                  {Math.min(
                    pagination.pageIndex * pagination.pageSize + 1,
                    total
                  ).toLocaleString()}
                </span>
                {" – "}
                <span className="font-medium text-foreground">
                  {Math.min(
                    (pagination.pageIndex + 1) * pagination.pageSize,
                    total
                  ).toLocaleString()}
                </span>{" "}
                of{" "}
                <span className="font-medium text-foreground">
                  {total.toLocaleString()}
                </span>
              </>
            ) : (
              "No results"
            )}
          </p>
          <p
            className={cn(
              "min-h-4 text-xs",
              error && hasLoadedData
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground",
              !(isRefreshing || (error && hasLoadedData)) && "invisible"
            )}
          >
            {error && hasLoadedData ? error : "Updating..."}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            disabled={!table.getCanPreviousPage()}
            onClick={() => {
              table.setPageIndex(0);
            }}
            size="icon"
            variant="outline"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            disabled={!table.getCanPreviousPage()}
            onClick={() => {
              table.previousPage();
            }}
            size="icon"
            variant="outline"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2 text-muted-foreground text-sm">
            Page{" "}
            <span className="font-medium text-foreground">
              {pagination.pageIndex + 1}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground">
              {totalPages || 1}
            </span>
          </span>
          <Button
            disabled={!table.getCanNextPage()}
            onClick={() => {
              table.nextPage();
            }}
            size="icon"
            variant="outline"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            disabled={!table.getCanNextPage()}
            onClick={() => {
              table.setPageIndex(totalPages - 1);
            }}
            size="icon"
            variant="outline"
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
