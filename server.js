var app = require('http').createServer(handler),
    io = require('socket.io').listen(app),
    fs = require('fs');

app.listen(8000);

//Game settings
var hand_size = 15;
var stacks = 5;
var prob_max = 100;
var norm_prob = (prob_max-9)/8
var prob = [3, //Assassin 
    norm_prob, norm_prob, norm_prob, norm_prob, norm_prob, norm_prob,
    norm_prob, norm_prob,
    3, //Joker
    3 //King
    ];
console.log("probabilties");
console.log(prob);
//End Settings

var game_state = {
    turn:0,
    select_turn:1,
    player1:{
        socket: null,
        hand:[],
        stacks: [],
        wins:0,
        selected: -1,
        ready: false
    },
    player2:{
        socket: null,
        hand:[],
        stacks: [],
        wins:0,
        selected: -1,
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
    var roll = Math.min(Math.floor(Math.random() * prob_max), prob_max);
    var cur_value = 0;
    for (var i = 0; i <= 10; i+=1)
    {
        if (roll <= cur_value + prob[i] &&
            roll > cur_value)
        {
            return i+1;
        }
        cur_value += prob[i];
    }
    return 11;
}

function count_hand(player, stack_id)
{
    var value = 0;
    for (var i=0; i< player.stacks[stack_id].cards.length; i+=1)
    {
        if (value >= 0)
        {
            var card = player.stacks[stack_id].cards[i];
            if (card == 1) {
                value = -1
            }
            else if (card == 10) {
                player.stacks[stack_id].swap = true;
            }
            else if (card == 11) {
                value = -2
            }
            else {
                value += card;
            }
        }
    }
    player.stacks[stack_id].value = value;
}

function recv_hand(player, data)
{
    try
    {
        player.stacks = [];
        console.log(data);
        for (var i=0; i < stacks; i+=1)
        {
            player.stacks.push({ 'value':0, 'swap':false, 
                                'cards':[], 'select':false });
            
            for (var j=0; j < data[i].length; j+=1)
            {
                player.stacks[i].cards.push(player.hand[data[i][j]]); 
            }
            count_hand(player, i);
        }
        player.ready = true;
        console.log(player.stacks);
    }
    catch (err)
    {
        console.log(err)
    }
}

function calc_winner(value1, value2)
{
    if (value1 == -1) //Assassin
    {
        if (value2 == -2) { return true; }
        else { return false; }
    }
    if (value1 == -2) //King
    {
        if (value2 == -1) { return false; }
        else { return true; }
    }
    if (value1 >= value2) { return true; }
    else { return false; }

}

function recv_select(player, data)
{
    if (player.stacks[data].select == false)
    {
        player.selected = data;
        player.stacks[data].select = true;
    }
    else
    {
        player.socket.emit('error', { msg: 'Stack has already been selected' });
    }
    if (game_state.player1.selected != -1 &&
        game_state.player2.selected != -1)
    {
        console.log(game_state.player1.selected + " " +
                    game_state.player2.selected);
        var value1, value2;
        value1 = game_state.player1.stacks[game_state.player1.selected].value;
        value2 = game_state.player2.stacks[game_state.player2.selected].value;
        var temp;
        var swap1 =game_state.player1.stacks[game_state.player1.selected].swap;
        var swap2 =game_state.player2.stacks[game_state.player2.selected].swap;
        var select1 = game_state.player1.selected;
        var select2 = game_state.player2.selected;
        if (swap1) {
            temp = value2;
            value2 = value1;
            value1 = temp;
        }
        if (swap2) {
            temp = value2;
            value2 = value1;
            value1 = temp;
        }
        if (calc_winner(value1, value2))
        {
            game_state.select_turn = 2;
            game_state.player1.wins += 1;
            game_state.player1.socket.emit('round_state',
            {'won':true, 'my':value1, 'op': value2, 
                'my_select':  select1, 'op_select': select2,
                'swap1':swap1, 'swap2':swap2}
            );
            game_state.player2.socket.emit('round_state',
            {'won':false, 'my':value2, 'op': value1, 
                'my_select':  select2, 'op_select': select1,
                'swap1':swap1, 'swap2':swap2}
            );
        }
        else
        {
            game_state.select_turn = 1;
            game_state.player2.wins += 1;
            //Player 2 wins
            game_state.player1.socket.emit('round_state', 
            {'won':false, 'my':value1, 'op': value2, 
                'my_select':  select1, 'op_select': select2,
                'swap1':swap1, 'swap2':swap2}
            );
            game_state.player2.socket.emit('round_state',
            {'won':true, 'my':value2, 'op': value1, 
                'my_select':  select2, 'op_select': select1,
                'swap1':swap1, 'swap2':swap2}
            );
            
        }
        if (game_state.player1.wins > stacks / 2)
        {
            //Player 1 wins
            game_state.player1.socket.emit('game_state', 'victory');
            game_state.player2.socket.emit('game_state', 'defeat');
        }
        if (game_state.player2.wins > stacks / 2)
        {
            game_state.player2.socket.emit('game_state', 'victory');
            game_state.player1.socket.emit('game_state', 'defeat');
        }

        game_state.player1.selected = -1;
        game_state.player2.selected = -1;
    }
}

function start_select_phase()
{
    if (game_state.player1.ready && game_state.player2.ready)
    {
        game_state.player1.ready = false;
        game_state.player2.ready = false;
        console.log("Starting Select");
        var p1_len = [];
        var p2_len = [];
        for (var i=0; i<stacks; i+=1)
        {
            p1_len.push(game_state.player2.stacks[i].cards.length);
            p2_len.push(game_state.player1.stacks[i].cards.length);
        }
        console.log(p1_len);
        game_state.player1.socket.emit('select_start', 
            {'opp_hand': p1_len, 'hand': game_state.player1.stacks});
        game_state.player2.socket.emit('select_start', 
            {'opp_hand': p2_len, 'hand': game_state.player2.stacks});
    }
}

function game_start()
{
    if (game_state.player1.socket != null &&
        game_state.player2.socket != null)
    {
        console.log("Starting Game");
        game_state.player1.wins = 0;
        game_state.player2.wins = 0;
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
    if (game_state.player1.socket == null &&
        socket != game_state.player2.socket) { 
        console.log("Player 1 Joined");
        game_state.player1.socket = socket;
        game_start();
    }
    else if (game_state.player2.socket == null &&
        socket != game_state.player1.socket) {
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
    socket.on('select_stack', function (data) {
        var sel = -1;
        
        if (socket == game_state.player1.socket) {

            console.log("Recv from player 1");
            console.log("Send to player 2");
            console.log(game_state.player1.socket.id)
            console.log(game_state.player2.socket.id);
            recv_select(game_state.player1, data)
            if (game_state.select_turn == 2)
            {
                sel = game_state.player1.selected; 
            }
            console.log("Sending");
            game_state.player2.socket.emit('stack_select', sel);

            
        }

        else if (socket == game_state.player2.socket) {
            recv_select(game_state.player2, data)
            if (game_state.select_turn == 1)
            {
                sel = game_state.player2.selected; 
            }
            game_state.player1.socket.emit('stack_select', sel);
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
