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

serv.listen(5000, function(){
    // LOAD START MAP
    console.log("Load obstaculos");
    Obstaculo.onConnect();
});
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

    self.getDistance = function(pt){	//return distance (number)
        return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2));
    };

    self.collisionSide = function(a, b){
        // get the vectors to check against
        var vX = (a.x + (a.width / 2)) - (b.x + (b.width / 2)),
            vY = (a.y + (a.height / 2)) - (b.y + (b.height / 2)),
        // add the half widths and half heights of the objects
            hWidths = (a.width / 2) + (b.width / 2),
            hHeights = (a.height / 2) + (b.height / 2),
            colDir = null;

        // if the x and y vector are less than the half width or half height, they we must be inside the object, causing a collision
        if (Math.abs(vX) < hWidths && Math.abs(vY) < hHeights) {
            // figures out on which side we are colliding (top, bottom, left, or right)
            var oX = hWidths - Math.abs(vX),
                oY = hHeights - Math.abs(vY);
            if (oX >= oY) {
                if (vY > 0) {
                    colDir = "t";
                    a.y += oY;
                } else {
                    colDir = "b";
                    a.y -= oY;
                }
            } else {
                if (vX > 0) {
                    colDir = "l";
                    a.x += oX;
                } else {
                    colDir = "r";
                    a.x -= oX;
                }
            }
        }
        return colDir;
    };

    return self;
};
var Obstaculo = function(id, x, y, width, height){
    var self = Entity(id,x, y, width, height);

    Obstaculo.list[self.id] = self;
    return self;
};
Obstaculo.list = {};
Obstaculo.onConnect = function(socket){
    Obstaculo(Math.random(), 200, 200, 50, 50);
    Obstaculo(Math.random(), 600, 100, 50, 50);
    Obstaculo(Math.random(), 400, 600, 50, 50);
};
Obstaculo.update = function(socket){
    var pack = [];
    for (var i in Obstaculo.list){
        var obstaculo = Obstaculo.list[i];
        pack.push({
            x: obstaculo.x,
            y: obstaculo.y,
            width: obstaculo.width,
            height: obstaculo.height
        });
    }
    return pack;
};
var Actor = function (id, x, y, width, height) {
    var self = Entity(id, x, y, width, height);
    self.spdX = 0;
    self.spdY = 0;
    self.maxSpd = 10;

    self.update = function(){
        self.updatePosition();
        self.checkCollision();
    };

    self.updatePosition = function(){
        self.x += self.spdX;
        self.y += self.spdY;
    };

    self.checkCollision = function(){
        // Obstaculo colision
        for(var i in Obstaculo.list){
            var o = Obstaculo.list[i];
            var side = self.collisionSide(self, o);
            if(side === "l" || side === "r") self.spdX = 0;
            if(side === "t" || side === "b") self.spdY = 0;
        }
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
        if (self.pressingRight && self.x + self.width < WIDTH) self.spdX = self.maxSpd;
        else if (self.pressingLeft && self.x > 0) self.spdX = -self.maxSpd;
        else self.spdX = 0;

        if (self.pressingUp && self.y > 0) self.spdY = -self.maxSpd;
        else if (self.pressingDown && self.y + self.height < HEIGHT) self.spdY = self.maxSpd;
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
        player: Player.update(),
        obstaculo: Obstaculo.update()
    };

    for (var i in SOCKET_LIST){
        var socket = SOCKET_LIST[i];
        socket.emit("newPosition",pack);
    }
},1000/25);