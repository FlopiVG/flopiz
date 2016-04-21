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

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
    console.log("Client conected");
});