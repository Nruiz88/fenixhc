'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Send, MessageSquare } from 'lucide-react';

export default function DeportistaChat() {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data } = await supabase.from('perfiles').select('nombre, apellido').eq('id', user.id).single();
        if (data) setUserName(`${data.nombre} ${data.apellido}`);
      }
    })();

    // Load existing messages
    (async () => {
      const { data } = await supabase.from('mensajes_chat').select('*').order('created_at', { ascending: true }).limit(100);
      if (data) setMsgs(data);
    })();

    // Subscribe to new messages
    const channel = supabase.channel('chat-global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_chat' }, (payload: any) => {
        setMsgs(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const handleSend = async () => {
    if (!text.trim() || !userId) return;
    const supabase = createClient();
    await supabase.from('mensajes_chat').insert({
      emisor_id: userId,
      contenido: text.trim(),
      tipo_contenido: 'texto',
    });
    setText('');
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
                  {msg.perfiles?.nombre || 'Anónimo'}
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
