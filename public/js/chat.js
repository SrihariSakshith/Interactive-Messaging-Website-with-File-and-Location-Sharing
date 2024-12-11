const socket = io()

// Elements
const $messageForm = document.querySelector('#message-form')
const $messageFormInput = $messageForm.querySelector('input')
const $messageFormButton = $messageForm.querySelector('button')
const $sendLocationButton = document.querySelector('#send-location')
const $fileInput = document.querySelector('#file-input')
const $sendFileButton = document.querySelector('#send-file')
const $messages = document.querySelector('#messages')

// Templates
const messageTemplate = document.querySelector('#message-template').innerHTML
const locationMessageTemplate = document.querySelector('#location-message-template').innerHTML
const sidebarTemplate = document.querySelector('#sidebar-template').innerHTML

// Options
const { username, room } = Qs.parse(location.search, { ignoreQueryPrefix: true })

// Autoscroll function
const autoscroll = () => {
    const $newMessage = $messages.lastElementChild
    const newMessageHeight = $newMessage.offsetHeight + parseInt(getComputedStyle($newMessage).marginBottom)
    if ($messages.scrollHeight - newMessageHeight <= $messages.scrollTop + $messages.offsetHeight) {
        $messages.scrollTop = $messages.scrollHeight
    }
}

// Messages and roomData event listeners
socket.on('message', (message) => {
    const html = Mustache.render(messageTemplate, {
        username: message.username,
        message: message.text,
        createdAt: moment(message.createdAt).format('h:mm a')
    })
    $messages.insertAdjacentHTML('beforeend', html)
    autoscroll()
})

socket.on('locationMessage', (message) => {
    const html = Mustache.render(locationMessageTemplate, {
        username: message.username,
        url: message.url,
        createdAt: moment(message.createdAt).format('h:mm a')
    })
    $messages.insertAdjacentHTML('beforeend', html)
    autoscroll()
})

socket.on('fileMessage', (message) => {
    const html = `<div class="message">
        <p><span class="message__name">${message.username}</span>
        <span class="message__meta">${moment(message.createdAt).format('h:mm a')}</span></p>
        <p><a href="${message.text}" target="_blank">${message.text.split('/').pop()}</a></p>
    </div>`
    $messages.insertAdjacentHTML('beforeend', html)
    autoscroll()
})


socket.on('roomData', ({ room, users }) => {
    const html = Mustache.render(sidebarTemplate, { room, users })
    document.querySelector('#sidebar').innerHTML = html
})

// Event listeners for sending messages, location, and file
$messageForm.addEventListener('submit', (e) => {
    e.preventDefault()
    $messageFormButton.setAttribute('disabled', 'disabled')
    const message = e.target.elements.message.value

    socket.emit('sendMessage', message, (error) => {
        $messageFormButton.removeAttribute('disabled')
        $messageFormInput.value = ''
        if (error) return console.log(error)
    })
})

$sendLocationButton.addEventListener('click', () => {
    if (!navigator.geolocation) return alert('Geolocation is not supported')
    $sendLocationButton.setAttribute('disabled', 'disabled')

    navigator.geolocation.getCurrentPosition((position) => {
        socket.emit('sendLocation', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        }, () => {
            $sendLocationButton.removeAttribute('disabled')
        })
    })
})

$sendFileButton.addEventListener('click', () => $fileInput.click())
$fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (file) {
        const reader = new FileReader()
        reader.onloadend = () => {
            socket.emit('sendFile', {
                fileName: file.name,
                fileData: reader.result
            }, (error) => {
                if (error) alert(error)
            })
        }
        reader.readAsDataURL(file)
    }
})

// Join room
socket.emit('join', { username, room }, (error) => {
    if (error) {
        alert(error)
        location.href = '/'
    }
})
