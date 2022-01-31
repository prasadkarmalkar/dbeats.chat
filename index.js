const Room = require('./chat.model');
const User = require('./user.model');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const PORT = process.env.PORT || 80
const io = require('socket.io')(PORT,
    {
      cors: {
        origin: "*",
        transports: ['websocket'],
        credentials: true
    },
    allowEIO3: true
    }
  );
const uri = process.env['ATLAS_URI'];
mongoose.connect(uri);
  io.on('connection', (socket) => {
    socket.on('joinroom', async ({ user_id, room_id }) => {
      const user = await User.findById(user_id);
      const room = await Room.findOne({ room_admin: room_id });
      const room_user = await User.findById(room_id);
      if (room && user) {
        await socket.join(room_user._id.toString());
        socket.emit('init', room.chats);
      } else if (user && room_user) {
        const withoutroom = await Room.create({
          room_admin: room_id,
          chats: [],
        });
        socket.emit('init', withoutroom.chats);
      }
    });
    socket.on('chatMessage', async ({ chat, room_admin }) => {
      try {
        const msgId = new mongoose.Types.ObjectId();
        const c = {
          _id: msgId,
          user_id: chat.user_id,
          username: chat.username,
          profile_image: chat.profile_image,
          type: chat.type,
          message:chat.message,
          createdAt:chat.createdAt
        }
        Room.findOneAndUpdate(
          { room_admin: room_admin },
          {
            $push: {
              chats: c,
            },
          },
          function (error, success) {
            if (error) {
              console.log(error);
            } else {
              io.to(room_admin.toString()).emit('message', c);
            }
          },
        );
      } catch (error) {
        console.log(error);
      }
    });
  });