const LOGO = [
  '███╗   ███╗ ██████╗ ███╗   ██╗███████╗██████╗',
  '████╗ ████║██╔═══██╗████╗  ██║██╔════╝██╔══██╗',
  '██╔████╔██║██║   ██║██╔██╗ ██║█████╗  ██████╔╝',
  '██║╚██╔╝██║██║   ██║██║╚██╗██║██╔══╝  ██╔══██╗',
  '██║ ╚═╝ ██║╚██████╔╝██║ ╚████║███████╗██║  ██║',
  '╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝',
  '        L E A D   T R A C E R   v1.0',
].join('\n');

/** Logo w ASCII. Czysto dekoracyjne, więc ukryte przed czytnikami ekranu. */
export function AsciiLogo({ className = '' }: { className?: string }) {
  return (
    <pre
      aria-hidden="true"
      className={`glow text-phosphor leading-[1.1] text-[7px] sm:text-[10px] select-none ${className}`}
    >
      {LOGO}
    </pre>
  );
}
