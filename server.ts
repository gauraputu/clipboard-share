import express from 'express';
import http from "node:http";
import { Server } from 'socket.io';
import prettier from 'prettier';
import process from "node:process";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Store active rooms and their content
const rooms = new Map();

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('User connected');

    // Handle room creation
    socket.on('createRoom', () => {
        const roomId = generateRoomId();
        rooms.set(roomId, { code: '', users: new Set() });
        socket.emit('roomCreated', roomId);
    });

    // Handle joining room
    socket.on('joinRoom', (roomId) => {
        if (!rooms.has(roomId)) {
            socket.emit('error', 'Room not found');
            return;
        }

        socket.join(roomId);
        const room = rooms.get(roomId);
        room.users.add(socket.id);
        
        // Send current code to new user
        socket.emit('initialCode', room.code);
        socket.emit('roomJoined', roomId);
        io.to(roomId).emit('userCount', room.users.size);
    });

    // Handle code updates
    socket.on('codeUpdate', ({ roomId, code }) => {
        if (!rooms.has(roomId)) return;
        
        const room = rooms.get(roomId);
        room.code = code;
        socket.to(roomId).emit('codeUpdated', code);
    });

    // Handle code formatting
    socket.on('formatCode', async ({ roomId, code }) => {
        try {
            const formattedCode = await prettier.format(code, {
                parser: 'babel',
                semi: true,
                singleQuote: true
            });
            io.to(roomId).emit('codeFormatted', formattedCode);
        } catch (_error) {
            socket.emit('error', 'Format failed: Invalid code');
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        for (const [roomId, room] of rooms.entries()) {
            if (room.users.has(socket.id)) {
                room.users.delete(socket.id);
                io.to(roomId).emit('userCount', room.users.size);
                
                // Clean up empty rooms
                if (room.users.size === 0) {
                    rooms.delete(roomId);
                }
            }
        }
    });
});

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});