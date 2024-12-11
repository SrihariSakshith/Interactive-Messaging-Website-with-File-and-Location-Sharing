const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const fs = require('fs')
const { Buffer } = require('buffer')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)
const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public')

// Middleware to serve static files
app.use(express.static(publicDirectoryPath))

// Ensure the 'uploads' directory exists within the 'public' directory
const uploadsDir = path.join(publicDirectoryPath, 'uploads')
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir)
}

io.on('connection', (socket) => {
    console.log('New WebSocket connection')

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options })
        if (error) return callback(error)

        socket.join(user.room)

        // Welcome message and notify other users
        socket.emit('message', generateMessage('Admin', 'Welcome!'))
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`))
        
        // Send room data to update sidebar
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id)
        const filter = new Filter()

        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed!')
        }

        io.to(user.room).emit('message', generateMessage(user.username, message))
        callback()
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
        callback()
    })

    socket.on('sendFile', (fileData, callback) => {
        const user = getUser(socket.id)
        if (!user) return callback('User not found')

        const fileBuffer = Buffer.from(fileData.fileData.split('base64,')[1], 'base64')

        // Construct file path
        const filePath = path.join(uploadsDir, fileData.fileName)
        
        // Save file
        fs.writeFile(filePath, fileBuffer, (err) => {
            if (err) {
                console.error('File save error:', err)
                return callback('Error saving file')
            }

            const fileURL = `/uploads/${encodeURIComponent(fileData.fileName)}`;
            io.to(user.room).emit('fileMessage', generateMessage(user.username, fileURL));
            callback()
        })
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

server.listen(port, () => {
    console.log(`http://localhost:3000/`)
    console.log(`Server is up on port ${port}`)
})
