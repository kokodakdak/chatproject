const SocketIO = require('socket.io');
const axios = require('axios');

//socket.io패키지를 불러와서 express서버와 연결
module.exports = (server, app, sessionMiddleware) => {
  const io = SocketIO(server, { path: '/socket.io' });//클라이언트와의 연결경로

  app.set('io', io);//라우터에서 io객체 쓸 수 있게 저장. req.app.get('io')로 접근가능
  const room = io.of('/room');//of: socket.io에 네임스페이스를 부여
  const chat = io.of('/chat');//네임스페이스구분으로 지정된 네임스페이스에 연결한 클라이언트들에게만 데이터전송

  io.use((socket, next) => {//io.use에 미들웨어 장착. 모든 웹소켓 연결시마다 실행됨
    sessionMiddleware(socket.request, socket.request.res, next);
  });

  room.on('connection', (socket) => {//이벤트 리스너
    console.log('room 네임스페이스에 접속');
    socket.on('disconnect', () => {
      console.log('room 네임스페이스 접속 해제');
    });
  });

  chat.on('connection', (socket) => {
    console.log('chat 네임스페이스에 접속');
    const req = socket.request;
    const { headers: { referer } } = req;
    const roomId = referer
      .split('/')[referer.split('/').length - 1]
      .replace(/\?.+/, '');
    socket.join(roomId);//네임스페이스 접속시 join
    socket.to(roomId).emit('join', {//특정방에 데이터전송
      user: 'system',
      chat: `${req.session.color}님이 입장하셨습니다.`,
    });
    socket.on('disconnect', () => {
      console.log('chat 네임스페이스 접속 해제');
      socket.leave(roomId);//접속해제시 leave메서드
      const currentRoom = socket.adapter.rooms[roomId];//참여중인 소켓정보
      const userCount = currentRoom ? currentRoom.length : 0;
      if (userCount === 0) {//접속인원이0명이면 방제거하는 http요청
        axios.delete(`http://localhost:8005/room/${roomId}`)
          .then(() => {
            console.log('방 제거 요청 성공');
          })
          .catch((error) => {
            console.error(error);
          });
      } else {
        socket.to(roomId).emit('exit', {
          user: 'system',
          chat: `${req.session.color}님이 퇴장하셨습니다.`,
        });
      }
    });
  });
};