export function Footer() {
  return (
    <footer className="bg-card border-t border-border py-8 mt-auto">
      <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} News Compass. All rights reserved.</p>
        <p className="mt-1">Powered by AI and News Aggregation</p>
      </div>
    </footer>
  );
}
