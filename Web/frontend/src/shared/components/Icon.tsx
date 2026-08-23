export function Icon({
  src,
  size = 20,
  className,
}: {
  src: string;
  size?: number;
  className?: string;
}) {
  return (
    <img
      className={
        className === undefined ? 'lucide-icon' : `lucide-icon ${className}`
      }
      src={src}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}
