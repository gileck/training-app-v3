interface FooterProps {
  isStandalone?: boolean;
}

export const Footer = ({ isStandalone }: FooterProps) => {
  return (
    <footer className={`mt-auto hidden border-t bg-muted/30 sm:block ${isStandalone ? 'pb-[calc(env(safe-area-inset-bottom)+16px)]' : ''}`}>
      <div className="mx-auto max-w-screen-lg px-4 py-3">
      </div>
    </footer>
  );
};

export default Footer;
