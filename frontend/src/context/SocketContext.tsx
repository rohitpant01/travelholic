import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import io, { Socket } from 'socket.io-client';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children, socketUrl }: { children: ReactNode, socketUrl: string }) => {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, token, isAuthenticated } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (!isAuthenticated || !user?._id || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    if (socketRef.current) return; // Prevent multiple connections

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket'], // Force websocket in React Native to avoid XHR polling timeouts
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 20000,
    });

    socketRef.current = newSocket;
    setSocket(newSocket); // Trigger context update for consumers like App.tsx

    newSocket.on('connect', () => {
      console.log('✅ [SOCKET] Connected:', newSocket.id);
      setIsConnected(true);
      newSocket.emit('join', user._id);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ [SOCKET] Disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.log('❌ [SOCKET] Connection Error:', err.message);
    });

    newSocket.io.on('reconnect', () => {
      console.log('🔄 [SOCKET] Reconnected');
      newSocket.emit('join', user._id);
    });

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [isAuthenticated, user?._id, socketUrl, token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
