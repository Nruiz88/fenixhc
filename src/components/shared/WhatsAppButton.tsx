import { CLUB_INFO } from '@/lib/constants';
import { MessageSquare } from 'lucide-react';

export function WhatsAppButton() {
  return (
    <a
      href={CLUB_INFO.whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 bg-green-500 text-white p-4 rounded-full shadow-lg hover:bg-green-600 transition-colors"
      title="WhatsApp"
    >
      <MessageSquare className="h-6 w-6" />
    </a>
  );
}
