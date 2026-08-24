import { Navbar } from '@/components/shared/Navbar';

export default function ClubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      {children}
    </div>
  );
}
