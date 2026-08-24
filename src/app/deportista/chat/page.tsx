'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { udb } from '@/lib/userQuery';
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
  const supabase = createClient();

  useEffect(() => {
    load();
    const ch = supabase.channel('chat').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_chat' }, (p: any) => loadMsg(p.new)).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    udb.select('perfiles', 'id, nombre, apellido', undefined, { single: true }).then(({ data }) => {
      if (data) { setUserId(data.id); setUserName(data.nombre); }
    });
  }, []);

  async function load() {
    const { data } = await udb.select('mensajes_chat', '*, perfiles(nombre, apellido)', undefined, { order: { column: 'created_at', ascending: true }, limit: 100 });
    setMsgs(data || []);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }
  async function loadMsg(msg: any) {
    const { data: p } = await udb.select('perfiles', 'nombre, apellido', { id: msg.emisor_id }, { single: true });
    setMsgs(prev => [...prev, { ...msg, perfiles: p }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !userId) return;
    await udb.insert('mensajes_chat', { emisor_id: userId, contenido: text, tipo_contenido: 'texto' });
    setText('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Chat Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-800 mb-4">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white"><MessageSquare className="h-5 w-5" /></div>
        <div>
          <h1 className="text-lg font-bold text-white">Chat del Club</h1>
          <p className="text-xs text-gray-400">Charlá con tus compañeros</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 px-1">
        {msgs.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center"><MessageSquare className="h-12 w-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-500">No hay mensajes aún</p><p className="text-xs text-gray-600 mt-1">Escribí el primer mensaje</p></div>
          </div>
        )}
        {msgs.map((m) => {
          const isMe = m.emisor_id === userId;
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${isMe ? 'order-2' : ''}`}>
                {!isMe && <p className="text-[10px] text-gray-500 mb-1 ml-1">{m.perfiles?.nombre}</p>}
                <div className={`px-4 py-2.5 rounded-2xl ${isMe ? 'bg-blue-600 text-white rounded-br-md' : 'bg-gray-800 text-gray-200 rounded-bl-md'}`}>
                  <p className="text-sm">{m.contenido}</p>
                </div>
                <p className={`text-[10px] text-gray-600 mt-0.5 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                  {new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-4 border-t border-gray-800">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input value={text} onChange={e => setText(e.target.value)} placeholder="Escribí un mensaje..." className="flex-1 bg-gray-800 border-gray-700 text-white rounded-full px-5" />
          <Button type="submit" size="icon" className="rounded-full bg-blue-600 hover:bg-blue-700 h-10 w-10 shrink-0"><Send className="h-4 w-4" /></Button>
        </form>
      </div>
    </div>
  );
}
