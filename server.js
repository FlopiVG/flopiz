/**
 * Created by FlopiVG on 21/04/2016.
 */
var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function(req, res){
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(5000);
console.log("Server started.");

var WIDTH = 1000;
var HEIGHT = 700;

var Entity = function(id, x, y, width, height){
    var self = {
        id: id,
        x: x,
        y: y,
        width: width,
        height: height
    };

    return self;
};
var Actor = function (id, x, y, width, height) {
    var self = Entity(id, x, y, width, height);
    self.spdX = 0;
    self.spdY = 0;
    self.maxSpd = 10;

    self.update = function(){
        self.updatePosition();
    };

    self.updatePosition = function(){
        self.x += self.spdX;
        self.y += self.spdY;
    };

    return self;
};
var Player = function(id, x, y, width, height){
    var self = Actor(id, x, y, width, height);
    self.pressingRight = false;
    self.pressingLeft = false;
    self.pressingUp = false;
    self.pressingDown = false;

    var super_update = self.update;
    self.update = function(){
        super_update();
        self.updateSpd();
    };

    self.updateSpd = function(){
        if(self.pressingRight) self.spdX = self.maxSpd;
        else if (self.pressingLeft) self.spdX = -self.maxSpd;
        else self.spdX = 0;

        if(self.pressingUp) self.spdY = -self.maxSpd;
        else if(self.pressingDown) self.spdY = self.maxSpd;
        else self.spdY = 0;
    };

    Player.list[id] = self;
    return self;
};
Player.list = {};
Player.onConnect = function(socket){
    var player = Player(socket.id, WIDTH/2, HEIGHT/2, 20, 20);

    socket.on('keyPress', function(data){
        if(data.inputId === 'left')
            player.pressingLeft = data.state;
        else if(data.inputId === 'right')
            player.pressingRight = data.state;
        else if(data.inputId === 'up')
            player.pressingUp = data.state;
        else if(data.inputId === 'down')
            player.pressingDown = data.state;
        else if(data.inputId === 'attack')
            player.pressingAttack = data.state;
        else if(data.inputId === 'mouseAngle')
            player.mouseAngle = data.state;
    });

    socket.emit("sendPlayer", player);
};
Player.onDisconnect = function(socket){
    console.log("Cliente " + socket.id + " desconectado.");
    delete Player.list[socket.id];
};
Player.update = function(socket){
    var pack = [];
    for (var i in Player.list){
        var player = Player.list[i];
        player.update();
        pack.push({
            id: player.id,
            x: player.x,
            y: player.y,
            width: player.width,
            height: player.height
        });
    }
    return pack;
};

var SOCKET_LIST = {};
var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
    socket.id = Math.random();
    SOCKET_LIST[socket.id] = socket;
    Player.onConnect(socket);
    console.log("Cliente " + socket.id + " conectado.");

    socket.on("disconnect", function () {
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket);
    });

    socket.on('latency', function (startTime, cb) {
        cb(startTime);
    });
});

// GAME LOOP
setInterval(function(){
    var pack = {
        player: Player.update()
    };

    for (var i in SOCKET_LIST){
        var socket = SOCKET_LIST[i];
        socket.emit("newPosition",pack);
    }
},1000/25);