export default function Logo({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dims = { sm: 28, md: 36, lg: 52 }[size];
  const wordmarkSize = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl' }[size];
  const subSize = { sm: 'text-[6px]', md: 'text-[8px]', lg: 'text-[10px]' }[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width={dims} height={dims} viewBox="0 0 44 44" fill="none" className="shrink-0">
        <path
          d="M22 35C13 29 7 22.5 7 15.5C7 10.3 11 7 15.2 7C18.4 7 20.8 8.9 22 11.4C23.2 8.9 25.6 7 28.8 7C33 7 37 10.3 37 15.5C37 22.5 31 29 22 35Z"
          fill="#E84E8A"
        />
        <path
          d="M22 35C13 29 7 22.5 7 15.5C7 10.3 11 7 15.2 7C18.4 7 20.8 8.9 22 11.4"
          stroke="#C93A72"
          strokeWidth="0.75"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
      </svg>
      <div className="leading-none">
        <p className={`font-script text-brand-pink leading-none ${wordmarkSize}`}>XOXO</p>
        <p className={`${subSize} font-semibold tracking-[0.2em] text-ink/50 leading-none mt-0.5`}>
          XOXOSTORE.PK
        </p>
      </div>
    </div>
  );
}
