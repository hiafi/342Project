var app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    fs = require('fs');

app.listen(8000);

//Game settings
var hand_size = 15;
var stacks = 5;
//End Settings

var game_state = {
    turn:0,
    player1:{
        socket: null,
        hand:[],
        stacks: [],
        wins:0,
        ready: false
    },
    player2:{
        socket: null,
        hand:[],
        stacks: [],
        wins:0,
        ready: false
    },
}

function handler (req, res) {
    fs.readFile(__dirname + '/client.html',
    function (err, data) {
        if (err) {
            res.writeHead(500);
            return res.end('Error loading page');
        }

        res.writeHead(200);
        res.end(data);
    });
}

function give_card()
{
    return Math.min(Math.floor(Math.random() * 11) + 1, 11);
}

function recv_hand(player, data)
{
    try
    {
        player.stacks = [];
        console.log(data);
        for (var i=0; i < stacks; i+=1)
        {
            player.stacks.push([]);
            for (var j=0; j < data[i].length; j+=1)
            {
                player.stacks[i].push(player.hand[data[i][j]]); 
            }
        }
        player.ready = true;
        console.log(player.stacks);
    }
    catch (err)
    {
        console.log(err)
    }
}

function start_select_phase()
{
    if (game_state.player1.ready && game_state.player2.ready)
    {
        console.log("Starting Select");
        var p1_len = [];
        var p2_len = [];
        for (var i=0; i<stacks; i+=1)
        {
            p1_len.push(game_state.player2.stacks[i].length);
            p2_len.push(game_state.player1.stacks[i].length);
        }
        game_state.player1.socket.emit('select_start', p1_len);
        game_state.player2.socket.emit('select_start', p2_len);
    }
}

function game_start()
{
    if (game_state.player1.socket != null &&
        game_state.player2.socket != null)
    {
        console.log("Starting Game");
        game_state['player1']['hand'] = []
        game_state['player2']['hand'] = []
        for (var i=0; i<hand_size; i+=1)
        {
            game_state['player1']['hand'].push(give_card());
            game_state['player2']['hand'].push(give_card());
        }
        game_state.player1.socket.emit(
            'start', {hand:game_state.player1.hand});
        game_state.player2.socket.emit(
            'start', {hand:game_state.player2.hand});
    }
}

io.sockets.on('connection', function (socket) {
    if (game_state.player1.socket == null) { 
        console.log("Player 1 Joined");
        game_state.player1.socket = socket;
        game_start();
    }
    else if (game_state.player2.socket == null) {
        console.log("Player 2 Joined");
        game_state.player2.socket = socket;
        game_start();
    }
    else {
        socket.emit('error', { msg: 'Game is full' });
    }
    socket.on('disconnect', function (data) {
        if (socket == game_state.player1.socket)
        {
            game_state.player1.socket = null;
        }
        else if (socket == game_state.player2.socket)
        {
            game_state.player2.socket = null;
        }
    });
    socket.on('start', function (data) {
        game_start();
    });
    socket.on('get_hand', function (data) {
        if (socket == game_state.player1.socket) {
            socket.emit('get_hand', {hand:game_state.player1.hand});
        }
        else {
            socket.emit('get_hand', {hand:game_state.player2.hand});
        } 
    });
    socket.on('hand_ordered', function (data) {
        console.log("Ordered hand");
        if (socket == game_state.player1.socket) {
            recv_hand(game_state.player1, data)
        }
        else {
            recv_hand(game_state.player2, data)
        }
        start_select_phase();
    });
});
