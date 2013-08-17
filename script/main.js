var socket = io.connect();
	
	jQuery(function ($) { 
		// save username later
		var nick = "";
	
		// jquery elements
		var setNicknameForm = $('#set-nickname'); 
		var $nicknameDiv = $('#nicknames');
		var $nicknameBox = $('#nickname');
		var nicknamesList = $('#nicknames ul'); 
		var message = $('#message'); 
		var messages = $('#messages'); 
		var startGameDiv = $('#startGameDiv');
		var $introText = $('#introText');
		var $startGameForm = $('#start-game');
		var $wordError = $('#wordError');
		var sendHintDiv = $('#send-hint');
		var hint = $('#hint');
		var $guessForm = $('#guessForm');
		var guess = $('#guess');
		var hints = $('#hints');
		var openGuesses = $('.openGuess');
		var secretWord = $('#secretWord');
		var $currentLetters = $('#currentLetters h1');
		var $hintLabel = $('#hintLabel');
		var $guessLabel = $('#guessLabel');
		
		// add alpha to validate
		 $.validator.addMethod("alphaOnly",  function(value, element) {
			return /^[a-z]+$/i.test(value);
		}, "Only alphabetic characters are allowed.");
		
		// make sure a name is entered in the validate form
		var wordValidator = $startGameForm.validate({
			rules: {
				secretWord: {
					required: true,
					alphaOnly: true
				}
			},
			errorPlacement: function(error, element){
				$wordError.html(error);
			}
		});
		
		var guessValidator = $guessForm.validate({
			rules: {
				hint: "required",
				guess: {
					required: true,
					alphaOnly: true
				}
			},
			highlight: function(element, errorClass, validClass){
				$(element).parent().parent().addClass('error');
			},
			unhighlight: function(element, errorClass, validClass){
				$(element).parent().parent().removeClass('error');
			},
			errorPlacement: function(error, element){
				if(element.attr('name') == 'hint'){
					$hintLabel.html(error);
					$hintLabel.css('visibility', 'visible');
				} else{
					$guessLabel.html(error);
					$guessLabel.css('visibility', 'visible');
				}
			},
			submitHandler: function(form){
				
			},
			onfocusout: false
		});
		
		// set autocomplete off
		message.attr('autocomplete', 'off');
		hint.attr('autocomplete', 'off');
		guess.attr('autocomplete', 'off');
		
		// apply masonry layout
		hints.masonry({
			itemSelector : '.openGuess',
			isResizable: true,
		});
		
		// resize message div if height of user div increases
		$nicknameDiv.resize(function(e){
			var height = $(this).height();
			messages.css('top', height);
		});

		if(readCookie('name')){
			nick = readCookie('name');
			socket.emit('nickname', nick, function(data){
				if(data.validName){
					console.log('readCookie: ' + data.isWs);
					setupGame(data.isWs);
					if(data.isWs){
						becomeWordsmith();
						if (data.game.state === 'wsDisconnect'){
							data.game.state = 'active';
							socket.emit('ws back');
						}
					}
					loadGameScreen(data);
				} else{
					setNicknameForm.before('<div class="alert">You are already logged in!</div>'); 
					setNicknameForm.hide();
				}
			});
			console.log("You're returning!");
		} else{
			setupGame(false);
		}
		
		// function to parse a cookie
		function readCookie(name) {
			var nameEQ = name + "=";
			var ca = document.cookie.split(';');
			for(var i=0;i < ca.length;i++) {
				var c = ca[i];
				while (c.charAt(0)==' ') c = c.substring(1,c.length);
				if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
			}
			return null;
		}
		
		// hides and shows divs necessary to switch to game screen
		function loadGameScreen(data){
			$('#container1').hide(); 
				$('body').css("background-color", "white");
				$('#boxes').show();
				message.autosize();
				// if current letters is a non-empty string, hide start game div & display letters
				if(data.game.state === 'active'){
					// if current letters, then game has started so hide the startgame
					startGameDiv.hide();
					hints.masonry('reload');
				} else{
					$introText.html(data.game.message);
					// game has not yet started
					sendHintDiv.hide();
			}
		}
		
		/* Loads guesses for the first time when the user enters their nickname
		   Takes the just saved nickname as an arg
		*/
		function setupGame(isWs){
			console.log(isWs);
			socket.emit('setup game', function(data){
				$currentLetters.html(data.letters);
				var html = '';
				if(isWs) {
					for (var i = data.index; i < data.openGuesses.length; i++) { 
						if(data.openGuesses[i] != null){
							console.log('hint: ' + data.openGuesses[i].hint + ' isOpen: ' + data.openGuesses[i].isOpen);
							// right now this leaves out input boxes without checking to see if the user is returning
							html += '<div id="' + i + '" class="openGuess well"';
							html += (!data.openGuesses[i].isOpen) ? ' style="background-color:#FFE0C7">' : '>';
							html += '<span class="countdown badge badge-important"></span><strong>' + data.openGuesses[i].user + '</strong><br/>' + data.openGuesses[i].hint;	
							html += '</br><input type="text" class="reactBox" /> </div>';
						}
					} 
				}else{
					for (var i = data.index; i < data.openGuesses.length; i++) { 
						if(data.openGuesses[i] != null){
							console.log('hint: ' + data.openGuesses[i].hint + ' isOpen: ' + data.openGuesses[i].isOpen);
							// right now this leaves out input boxes without checking to see if the user is returning
							html += '<div id="' + i + '" class="openGuess well"';
							html += (!data.openGuesses[i].isOpen) ? ' style="background-color:#FFE0C7">' : '>';
							html += '<span class="countdown badge badge-important"></span><strong>' + data.openGuesses[i].user + '</strong><br/>' + data.openGuesses[i].hint + '</div>';		
						}
					} 
				}
				// clear any guesses that may have been processed in the background while the user was picking their nickname
				hints.val('');
				hints.append(html);
			});
		}
		
		// sets nickname & shows message box if a valid nickname is submitted
		setNicknameForm.submit(function(event) { 
			event.preventDefault(); 
			nick = $nicknameBox.val();
			if(nick != ''){
				socket.emit('nickname', nick, function (data) { 
					if (data.validName) { 
						document.cookie = 'name=' + nick + '; path=/'
						loadGameScreen(data);
					} else { 
						// **make sure error doesn't come up more than once
						if($('#set-nickname .alert').length === 0){
							setNicknameForm.before('<div class="alert">That username is already taken</div>'); 
						}
					} 
				});
			}			
		}); 
		
		// update list of nicknames when users connect and disconnect
		socket.on('nicknames', function (data) { 
			var html = ''; 
			for (var i = 0; i < data.length; i++) { 
				html += '<li>' + data[i] + '</li>'; 
			} 
			nicknamesList.empty().append(html); 
		});
		
		
		// call createGame when the create game button is clicked or when enter is pressed in the secretWord input box
		$startGameForm.submit(
			function(e){
				e.preventDefault();
				var errors = wordValidator.numberOfInvalids();
				if (!errors){
					var word = secretWord.val();
					secretWord.val('');
					socket.emit('create game', {
						nick: nick,
						secretWord: word
					}, function(data){
						if(data){
							becomeWordsmith();
						}
					});
				}
			}
		);
		
		// loads the ws script files
		function becomeWordsmith(){
			sendHintDiv.hide();
			hints.off();
			socket.removeListener('correct reaction', correctReaction);
			$.getScript("script/wordsmith.js").done(function(){
				console.log("got wordsmith js file!");
			}).fail(function(jqxhr, settings, exception){
				console.log("loading wordsmith js file failed... :( " + settings + " " + exception);
			});
		}
		
		// displays hint/guess boxes and currentLetters when game has started
		socket.on('create game', function(data){
			console.log('Wordsmith: ' + data.wordsmith + ' First letter: ' + data.currentLetters);
			startGameDiv.hide();
			sendHintDiv.show();
			$currentLetters.html(data.currentLetters);
		});
		
		// submit hints when hint button clicked or enter button pressed in guess box
		$guessForm.submit(
			function(e){
				e.preventDefault();
				var errors = guessValidator.numberOfInvalids();
				if (!errors){
					createHint();
					guessValidator.resetForm();
				}
			}
		);
		// function to send hint & guess to socket server
		function createHint(){
			socket.emit('user guess', {
				hint: hint.val(),
				guess: guess.val()
			});
			hint.val('');
			guess.val('');
		};
		
		// receives and displays hints
		socket.on('user guess', function(data){
			var html = '<div id="' + data.id + '" class="openGuess well"><span class="countdown badge badge-important"></span> <strong>' + data.nick + '</strong> </br>' + data.hint;
			if(data.canReact){
				html += '</br><input type="text" class="reactBox" /> </div>';
			} else{
				html += '</div>';
			}
			hints.append(html);
			hints.masonry('reload');
		});
		
		// send reactions to server
		hints.on('keydown', '.reactBox', function(e){
				if(e.keyCode==13){
					var box = $(this);
					// get id of guess
					var id = box.parent().attr("id");
					console.log("Reaction to guess#" + id);
					socket.emit('user reaction', {
						id: id,
						reaction: box.val(),
						nick: nick
					}, function(data){
						// if the callback is false, don't let user have another try at reacting
						if(!data){
							box.val('');
						}
					});
					
				}
			}
		);
		
		/* receive correct reactions,
		   declared as its own function b/c 
		   the func is removed for wordsmiths */
		function correctReaction(data){
			$box = $('#' + data.id);
			$box.children(".reactBox").hide();
			$box.effect("highlight", {color: "#FFE0C7"}, 500, function(){
				$box.animate({backgroundColor: "#FFE0C7"}, 500, function(){
					$box.children("strong").append(" & " + data.reactingNick);
				});
			})
		}
		socket.on('correct reaction', correctReaction);
		
		// removes hints when they have timed out
		socket.on('delete hint', function(data, callback){
			if(data.isWs){
				$('#' + data.id).animate({backgroundColor: "#CC99FF"}, 500, function(){
					$('#' + data.id).fadeOut(function(){ 
						$(this).remove();
						hints.masonry('reload');
					});
				});
			} else{
				$('#' + data.id).fadeOut(function(){ 
					$(this).remove();
					hints.masonry('reload');
				});
			}
		});
		
		// updates the countdown
		socket.on('countdown', function(data){
			var $id = $('#'+data.id);
			var $count = $('#'+data.id).children('.countdown');
			$count.html(data.countdown);
		});
		
		// updates current letters
		socket.on('next letter', function(data){
			$currentLetters.html(data);
		});
		
		// *** make message box bigger as it fills up
		// submits messages to server
		message.keydown(
			function(e) {
				if (e.keyCode == 13 && e.shiftKey){
					return ;
				} else if(e.keyCode == 13) {
					e.preventDefault();
					socket.emit('user message', message.val()); 
					message.val('').focus(); 
				}
			}
		);
		
		// receives messages and displays them
		socket.on('user message', function (data) { 
			// check if the scroll is down
			var isScrolledDown = (messages[0].scrollHeight - messages[0].scrollTop <= messages[0].offsetHeight);
		
			// add message
			messages.append('<p><strong>' + data.nick + ':</strong> ' +  data.message + '</p>'); 
		
			// scroll down the scrollbar
			messages[0].scrollTop = isScrolledDown ? messages[0].scrollHeight : messages[0].scrollTop;
		}); 
		
		// ends game
		socket.on('end game', function (data){
			sendHintDiv.hide();
			hints.html('');
			$introText.html(data.msg);
			startGameDiv.show();
		});
		
		// pauses the game when the ws disconnects
		socket.on('ws disconnect', function(data){
			console.log(data);
			sendHintDiv.hide();
			hints.hide();
			$introText.html(data.msg);
			startGameDiv.show();
		});
		
		// resume game when the ws is back
		socket.on('ws back', function(){
			startGameDiv.hide();
			hints.show();
			sendHintDiv.show();
		});
		
	}); 