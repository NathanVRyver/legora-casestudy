import { useState, useEffect } from 'react';

export function useTypingStatus(userId?: string) {
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const handleTyping = (event: CustomEvent) => {
      const { senderId, isTyping: typing } = event.detail;
      console.log('useTypingStatus received event:', { senderId, typing, userId });

      if (senderId === userId) {
        console.log('Setting typing status:', typing);
        setIsTyping(typing);
      }
    };

    window.addEventListener('user-typing' as any, handleTyping as any);

    return () => {
      window.removeEventListener('user-typing' as any, handleTyping as any);
    };
  }, [userId]);

  return isTyping;
}
