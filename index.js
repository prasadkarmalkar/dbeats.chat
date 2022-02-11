const Room = require("./chat.model");
const User = require("./user.model");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const PORT = process.env.PORT || 80;
const io = require("socket.io")(PORT, {
  cors: {
    origin: "*",
    transports: ["websocket"],
    credentials: true,
  },
  allowEIO3: true,
});
const uri = process.env["ATLAS_URI"];
mongoose.connect(uri);
io.on("connection", (socket) => {
  socket.on("joinroom", async ({ user_id, room_id }) => {
    const user = await User.findById(user_id);
    const room = await Room.findOne({ room_admin: room_id });
    const room_user = await User.findById(room_id);
    let chats = [];
    if (room && user) {
      for (var i = 0; i < room.chats.length; i++) {
        const u = await User.findById(room.chats[i].user_id).select({
          username: 1,
          profile_image: 1,
        });
        let chattemp = {
          _id: room.chats[i]._id,
          user_id: room.chats[i].user_id,
          username: u.username,
          profile_image: u.profile_image,
          type: room.chats[i].type,
          message: room.chats[i].message,
          createdAt: room.chats[i].createdAt,
        };
        if (room.chats[i].url) {
          chattemp.url = room.chats[i].url;
        }
        if (room.chats[i].reply_to) {
          chattemp.reply_to = room.chats[i].reply_to;
        }
        chats.push(chattemp);
      }
      await socket.join(room_user._id.toString());
      socket.emit("init", chats);
    } else if (user && room_user) {
      const withoutroom = await Room.create({
        room_admin: room_id,
        chats: [],
      });
      socket.emit("init", withoutroom.chats);
    }
  });
  socket.on("chatMessage", async ({ chat, room_admin }) => {
    try {
      const msgId = new mongoose.Types.ObjectId();
      let c = {
        _id: msgId,
        user_id: chat.user_id,
        type: chat.type,
        message: chat.message,
        createdAt: chat.createdAt,
      };
      if (chat.url) {
        c.url = chat.url;
      }
      if (chat.reply_to) {
        c.reply_to = chat.reply_to;
      }
      Room.findOneAndUpdate(
        { room_admin: room_admin },
        {
          $push: {
            chats: c,
          },
        },
        async function (error, success) {
          if (error) {
            console.log(error);
          } else {
            const u = await User.findById(c.user_id).select({
              username: 1,
              profile_image: 1,
            });
            c.username = u.username;
            c.profile_image = u.profile_image;
            io.to(room_admin.toString()).emit("message", c);
          }
        }
      );
    } catch (error) {
      console.log(error);
    }
  });
});
