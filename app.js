var express = require('express'),
    app = express(), 
    server = require('http').createServer(app),
    io = require('socket.io').listen(server), 
    nicknames = [],        // holds all current user's nicknames
    openGuesses = [],      // holds all guesses in round
    wordsmith = [],        // holds both the wordsmith's nickname & socket ** can delete socket??
    secretWord = '',       // the secret word picked by the wordsmith
    currentLetters = '',   // current letters known to user
    timers = [],           // holds setTimeouts for auto deleting hints, but overriden with setIntervals for counting down during contacts
    activeIndex = 0,		 // this index and higher of openGuesses still has active guesses
    wsCountdown = 15, 	 // # of seconds wordsmith has to react to a contacted guess
    inactiveGuess = 45000, // # of milliseconds before deleting an inactive guess
    game = {state: 'notStarted', message: 'To start the game, someone must pick a word.'}, // game.state (active, wsDisconnect, over, or notStarted) & game.message to display
    check = require('validator').check, // required for validation
    sanitize = require('validator').sanitize; // required for validation

server.listen(3000);
   
// routes to index + stylesheets + scripts
app.get('/', function (req, res) { 
	res.sendfile(__dirname + '/index.html'); 
}); 
app.get('/test.html', function (req, res) { 
	res.sendfile(__dirname + '/test.html'); 
}); 
app.get('/style/chat.css', function(req, res){
	res.sendfile(__dirname + '/style/chat.css');
});
app.get('/style/bootstrap.min.css', function(req, res){
	res.sendfile(__dirname + '/style/bootstrap.min.css');
});
app.get('/script/masonry.min.js', function(req, res){
	res.sendfile(__dirname + '/script/masonry.min.js');
});
app.get('/script/main.js', function(req, res){
	res.sendfile(__dirname + '/script/main.js');
});
app.get('/script/wordsmith.js', function(req, res){
	res.sendfile(__dirname + '/script/wordsmith.js');
});
app.get('/script/resize.min.js', function(req, res){
	res.sendfile(__dirname + '/script/resize.min.js');
});
app.get('/script/autosize.min.js', function(req, res){
	res.sendfile(__dirname + '/script/autosize.min.js');
});
app.get('/script/jquery-ui-1.10.2.custom.min.js', function(req, res){
	res.sendfile(__dirname + '/script/jquery-ui-1.10.2.custom.min.js');
});
app.get('/script/jquery.validate.min.js', function(req, res){
	res.sendfile(__dirname + '/script/jquery.validate.min.js');
});

io.sockets.on('connection', function (socket) { 
	
	/* receives new nicknames, sends error if nickname is invalid
	   otherwise the nickname is added to list of nicknames
	   and sent back to the client
	*/
	socket.on('nickname', function (data, callback) { 
		if (nicknames.indexOf(data) != -1) { 
			callback({
				validName: false
			}); 
		} else {
			if(data===wordsmith.nick){
				var isWs = true;
				wordsmith.socket = socket;
			} else{
				var isWs = false;
			}
			callback({
				validName: true,
				isWs: isWs,
				game: game
			}); 
			nicknames.push(data); 
			socket.nickname = data; 
			console.log('New user! Nicknames are ' + nicknames); 
			io.sockets.emit('nicknames', nicknames); 
		} 
	}); 
	
	socket.on('create game', function(data, callback){
		isWsSet = (wordsmith.nick) ? true : false;
		wordsmith.nick = data.nick;
		if(isWsSet) wordsmith.socket.emit('refresh ws');
		wordsmith.socket = socket;
		var word = sanitizeInput(data.secretWord);
		secretWord = word.toUpperCase();
		currentLetters = secretWord.charAt(0);
		io.sockets.emit('create game', {
			wordsmith: wordsmith.nick,
			currentLetters: currentLetters
		});
		game.state = 'active';
		console.log("Wordsmith: " + wordsmith.nick + " Secret Word: " + secretWord);
		callback(true);
	});
	
	
	socket.on('setup game', function(callback){
		callback({
			openGuesses: openGuesses, 
			index: activeIndex, 
			letters: currentLetters
		});
	});
	
	// receive user guesses & broadcast them back to be displayed
	socket.on('user guess', function(data){
		/* the index of openGuesses is the id# of the guess which is itself an array
		*/
		var id = openGuesses.length;
		var hint = sanitizeInput(data.hint);
		var guess = sanitizeInput(data.guess);
		var newGuess = new userGuess(hint, guess, socket.nickname);
		openGuesses.push(newGuess);
		timers[id] = setTimeout(function() {
			io.sockets.emit('delete hint', { id: id });
			delete openGuesses[id];
			if (id === activeIndex + 1) activeIndex++;
			console.log("Timer called!");
		}, inactiveGuess);
		socket.emit('user guess', {
			id: id,
			nick: socket.nickname,
			hint: hint,
			canReact: false
		});
		socket.broadcast.emit('user guess', { 
			id: id,
			nick: socket.nickname, 
			hint: hint,
			canReact: true
		});
	});
	
	// guess object
	function userGuess(hint, guess, user){
		this.hint = hint;
		this.guess = guess;
		this.user = user;
		this.isOpen = true;
	}
	
	// receive user reactions
	socket.on('user reaction', function(data, callback){
		var id = data.id;
		if(openGuesses[id]['guess'].toLowerCase() == data.reaction.toLowerCase()){
			clearTimeout(timers[id]);
			openGuesses[id].isOpen = false;
			io.sockets.emit('correct reaction', {
				id: id,
				reactingNick: data.nick
			});
			var countdown = wsCountdown;
			timers[id] = setInterval(function(){
				if(countdown >= 0){
					io.sockets.emit('countdown', {
						id: id,
						countdown: countdown
					});
				} else{
					io.sockets.emit('delete hint', {id: id});
					delete openGuesses[id];
					clearInterval(timers[id]);
					if (id === activeIndex + 1) activeIndex++;
					getNextLetter();
				}
				countdown--;
			}, 1000);
		} else{
			callback(false);
		}
	});
	
	// update current letters & emit them to users
	function getNextLetter(){
		var length = currentLetters.length;
		currentLetters = secretWord.substring(0, length+1);
		io.sockets.emit('next letter', currentLetters);
		// if entire word is displayed end the game
		if ((length + 1) === secretWord.length){
			game.state = 'over';
			game.message = 'Game over!  Start a new game?'
			io.sockets.emit('end game', {msg: game.message});
			for(var i = activeIndex; i < openGuesses.length; i++){
				if(openGuesses[i]){
					if(openGuesses[i].isOpen){
						clearTimeout(timers[i]);
					} else{
						clearInterval(timers[i]);
					}
				}
			}
			openGuesses.length = 0;
			wordsmith.length = 0;
			timers.length = 0;
			activeIndex = 0;
		}
	}
	
	socket.on('ws reaction', function(data, callback){
		var id = data.id;
		if(openGuesses[id]['guess'].toLowerCase() == data.reaction.toLowerCase()){
			io.sockets.emit('delete hint', { id: id, isWs: true });
			if (id === activeIndex + 1) activeIndex++;
			if(openGuesses[id].isOpen){
				clearTimeout(timers[id]);
			} else{
				clearInterval(timers[id]);
			}
			delete openGuesses[id];
		} else{
			callback(false);
		}
	});
	
	// receive message
	socket.on('user message', function (data) { 
		var msg = sanitizeInput(data);
		io.sockets.emit('user message', { 
			nick: socket.nickname, 
			message: msg
		});
	});
	
	socket.on('disconnect', function () { 
		if (!socket.nickname) return; 
		if (nicknames.indexOf(socket.nickname) > -1) { 
			nicknames.splice(nicknames.indexOf(socket.nickname), 1); 
		} 
		console.log(socket.nickname);
		// if the ws disconnects, stop the game and let everyone else know
		if (socket.nickname === wordsmith.nick){
			game.state = 'wsDisconnect';
			game.message = socket.nickname + ' has disconnected!  Wait for ' + socket.nickname + ' to reconnect or start a new game.';
			io.sockets.emit('ws disconnect', {msg: game.message});
		}
		console.log('User disconnected! Nicknames are ' + nicknames); 
		io.sockets.emit('nicknames', nicknames); 
	});
	
	socket.on('ws back', function(){
		game.state = 'active';
		game.message = '';
		socket.broadcast.emit('ws back');
	});
	
	// trims, encodes, and prevents xss of input
	function sanitizeInput(input){
		var msg = sanitize(input).trim();
		msg = sanitize(msg).entityEncode();
		msg = sanitize(msg).xss();
		return msg;
	}
	
});

		