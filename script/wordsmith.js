jQuery(function ($) { 
	// send reactions to server
	$('#hints').on('keydown', '.reactBox', function(e){
		if(e.keyCode==13){
			var box = $(this);
			// get id of guess
			var id = box.parent().attr("id");
			console.log("WS Reaction to guess#" + id);
			socket.emit('ws reaction', {
				id: id,
				reaction: box.val()
			}, function(data){
				// **say it was incorrect
				if(!data){
					box.val('');
					console.log('Incorrect ws reaction');
				}
			});
		}
	});
	
	socket.on('correct reaction', function(data){
		$box = $('#' + data.id)
		$box.effect("highlight", {color: "#FFE0C7"}, 500, function(){
			$box.animate({backgroundColor: "#FFE0C7"}, 500, function(){
				$box.children("strong").append(" & " + data.reactingNick);
			});
		})
		console.log('WS Client: Users have a correct contact');
	});
	
	socket.on('refresh ws', function(){
		location.reload(true);
	});
});