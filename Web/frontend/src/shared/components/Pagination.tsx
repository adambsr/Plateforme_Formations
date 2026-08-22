interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange(page: number): void;
  label?: string;
  disabled?: boolean;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  label = 'Pagination',
  disabled = false,
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <nav className="pagination" aria-label={label}>
      <button
        className="secondary-button"
        type="button"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Précédent
      </button>
      <span aria-live="polite">
        Page <strong>{page}</strong> sur {pages} · {total} éléments
      </span>
      <button
        className="secondary-button"
        type="button"
        disabled={disabled || page >= pages}
        onClick={() => onPageChange(page + 1)}
      >
        Suivant
      </button>
    </nav>
  );
}
