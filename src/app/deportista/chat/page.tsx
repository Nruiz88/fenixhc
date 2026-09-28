'use client';
import { useState, useEffect, useRef } from 'react';
import { getCurrentUser } from '@/lib/auth-client';
import { userDb } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageSquare } from 'lucide-react';

const POLL_MS = 5000;

export default function DeportistaChat() {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    try {
      const { data } = await userDb.select('mensajes_chat', '*', undefined, {
        limit: 100,
        order: { column: 'created_at', ascending: true },
      });
      if (!data) return;

      // Resolve sender names
      const emisorIds = Array.from(new Set(data.map((m: any) => m.emisor_id).filter(Boolean)));
      let perfiles: Record<string, any> = {};
      if (emisorIds.length > 0) {
        const { data: ps } = await userDb.select('perfiles', 'id, nombre, apellido', { id: emisorIds });
        (ps || []).forEach((p: any) => { perfiles[p.id] = p; });
      }

      setMsgs(data.map((m: any) => ({ ...m, perfiles: perfiles[m.emisor_id] || null })));
    } catch {}
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const user = await getCurrentUser();
      if (user) {
        setUserId(user.id);
        setUserName(`${user.nombre || ''} ${user.apellido || ''}`.trim());
      }
      await loadMessages();
      interval = setInterval(loadMessages, POLL_MS);
    })();

    return () => { if (interval) clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const handleSend = async () => {
    if (!text.trim() || !userId) return;
    const { error } = await userDb.insert('mensajes_chat', {
      emisor_id: userId,
      contenido: text.trim(),
      tipo_contenido: 'texto',
    });
    if (!error) {
      setText('');
      loadMessages();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Chat del Club</h1>
          <p className="text-xs text-gray-500">Charlá con tus compañeros de equipo</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {msgs.length === 0 && (
          <div className="text-center py-20">
            <MessageSquare className="h-16 w-16 text-gray-800 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No hay mensajes aún</p>
            <p className="text-gray-600 text-sm mt-1">Escribí el primer mensaje del grupo</p>
          </div>
        )}
        {msgs.map((msg: any) => (
          <div key={msg.id} className={`flex ${msg.emisor_id === userId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
              msg.emisor_id === userId
                ? 'bg-[#DC2626] text-white rounded-br-md'
                : 'bg-gray-800 text-gray-200 rounded-bl-md'
            }`}>
              {msg.emisor_id !== userId && (
                <p className="text-[10px] font-semibold text-gray-400 mb-1">
                  {msg.perfiles ? `${msg.perfiles.nombre} ${msg.perfiles.apellido}` : 'Anónimo'}
                </p>
              )}
              <p className="text-sm">{msg.contenido}</p>
              <p className="text-[10px] opacity-50 mt-1 text-right">
                {new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-4">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Escribí un mensaje..."
            className="bg-gray-800 border-gray-700 text-white h-12 rounded-xl"
          />
          <Button
            onClick={handleSend}
            disabled={!text.trim()}
            className="bg-[#DC2626] hover:bg-[#B91C1C] h-12 w-12 rounded-xl p-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
