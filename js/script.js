
var allTracks = [],
	playlist = [],
	i = 0, 				// Номер проигрываемого трека
	shuffle = false,
	repeat = 0,
	lastPlayed = [],
	timer = 0;



startPlayerWhenReady();


/**
 *  Dropping
 */

var dropZone = $('#drop-zone'),
	searchInput = $('#searchBox');

$(document).on('dragover', function(event) {
	event.stopPropagation();
	event.preventDefault();

	dropZone.removeClass('hidden');
});

dropZone.on('dragleave', function(event) {
	event.stopPropagation();
	event.preventDefault();

	dropZone.addClass('hidden');
});

dropZone.on('dragover', function(e) {
	e.stopPropagation();
	e.preventDefault();
	e.originalEvent.dataTransfer.dropEffect = 'copy';
});


dropZone.on('drop', function(e) {
	e.stopPropagation();
	e.preventDefault();


	if(e.originalEvent.dataTransfer.items){
		// Для Chrome

		var items = e.originalEvent.dataTransfer.items;
		for(var j=0; j<items.length; j++){
			var item = items[j].webkitGetAsEntry();
			if(item){
				traverseFileTree(item);
			}
		}
	}
	else{

		var files = e.originalEvent.dataTransfer.files;

		for(var j=0; j<files.length; j++){
			if(files[j].type.match(/audio\/(mp3|mpeg)/)){

				getID3Data(files[j], function (song) {
					allTracks.push(song);
					playlist.push(song);
					$('#list').append($(returnTrackHTML(song, playlist.length-1)));
				});
			}
		}
	}

	if(allTracks.length){
		searchInput.val('');
		searchInput.trigger('input');
	}

	dropZone.addClass('hidden');
});

function traverseFileTree(item,path) {
	path = path || "";
	if(item.isFile){
		item.file(function(file){
			if(file.type.match(/audio\/mp3/)){
				getID3Data(file, function (song) {
					allTracks.push(song);
					playlist.push(song);
					$('#list').append($(returnTrackHTML(song,playlist.length-1)));
				});
			}
		})
	}
	else if(item.isDirectory){
		var dirReader = item.createReader();
		dirReader.readEntries(function (entries) {
			for(var j=0; j<entries.length; j++){
				traverseFileTree(entries[j], path + item.name + "/");
			}
		})
	}
}

function getID3Data(file, done) {

	getTags(file,function(result){

		result.audioTrack = file;
		result.playing = false;
		done(result);

	});
}

function getTags(file,done){

	var result = {};

	ID3.loadTags(file.name, function() {

		var tags = ID3.getAllTags(file.name);

		result.artist = tags.artist || "Unknown Artist";
		result.title = tags.title || "Unknown";
		result.album = tags.album || "";
		if(tags.picture && tags.picture.data && tags.picture.data.length) {
			result.picture = tags.picture;
			getImageSource(result.picture, function (imageSource) {
				result.picture = imageSource;
				done(result);
			});
		}
		else {
			result.picture = 'img/default.jpg';
			done(result);
		}


	}, {
		tags: ["artist", "title", "album", "picture"],
		dataReader: FileAPIReader(file)
	});

}

function getImageSource(image, done) {
	var base64String = "";
	for (var j = 0; j < image.data.length; j++) {
		base64String += String.fromCharCode(image.data[j]);
	}
	done("data:" + image.format + ";base64," + window.btoa(base64String));
}


function readFile(file,done) {

	var reader = new FileReader();

	reader.onload = function(data){
		done(data);
	};

	reader.readAsDataURL(file);
}


/**
 * Audio Player
 */


var wavesurfer = Object.create(WaveSurfer);

wavesurfer.init({
	container: document.querySelector('#wave'),
	cursorColor: '#aaa',
	cursorWidth: 1,
	height: 80,
    waveColor: '#DDDDE0',
    progressColor: '#9A9A9C'
});

function playTrack(number){

	if(playlist[number] && playlist[i]) {

		lastPlayed.push(number);

		var file = playlist[i].audioTrack,
			result = {};


		readFile(file, function(result){
			result = file;
			wavesurfer.loadBlob(result);
		});

	}
	// If something went wrong stop playback.
	else{
		wavesurfer.stop();
	}

}


wavesurfer.on('ready', function () {

	wavesurfer.play();

	var duration = wavesurfer.getDuration();

	if(playlist[i]){
		document.title = playlist[i].artist + ' - ' + playlist[i].title;

		if(playlist[i].picture == 'img/default.jpg'){
			$('#cover-art-big').css("background", "");
		}
		else{
			$('#cover-art-big').css("background-image", "url("+ playlist[i].picture +")").css("background-repeat", "no-repeat").css("background-position", "center");
		}


		$('#track-desc').html('<b>' + playlist[i].title + '</b>  ' + playlist[i].artist);

		$('#current').text('0:00');
		$('#total').text(formatTime(duration));

		clearInterval(timer);
		timer = setInterval(function() {
			$('#current').text(formatTime(wavesurfer.getCurrentTime()));
		}, 1000);


		allTracks.forEach(function (tr) {
			tr.playing = false;
		});
		playlist[i].playing = true;

        $('.track').removeClass('active').eq(i).addClass('active');
	}

});


wavesurfer.on('finish', function () {
	if (shuffle){
		if (repeat == 2) {
			if (playlist[i]) {
				playTrack(i);
			}
		}
		else if (playlist.length > 1) {
			var temp = i;
			while (i == temp) {
				i = Math.floor(Math.random() * playlist.length);
			}
			if(playlist[i]) {
				playTrack(i);
			}
		}
	}
	else {
		if (!repeat) {
			if (i >= playlist.length - 1) {
				wavesurfer.stop();
			}
			else {
				i++;
				playTrack(i);
			}
		}
		else if (repeat == 1) {
			if (i >= playlist.length - 1) {
				i = 0;
			}
			else {
				i++;
			}
			playTrack(i);
		}
		else if (repeat == 2) {
			if (playlist[i]) {
				playTrack(i);
			}
		}
	}

});


wavesurfer.on('seek', function () {
	$('#current').text(formatTime(wavesurfer.getCurrentTime()));
});


/**
 * Кнопки плейера
 */


$('#next-button').on('click', function () {

	if (!shuffle) {
		i++;
		if (i > playlist.length - 1) {
			i = 0;
		}
	}
	else {
		if (playlist.length > 1) {
			var temp = i;
			while (i == temp) {
				i = Math.floor(Math.random() * playlist.length);
			}
		}
	}

	if(playlist[i]) {
		playTrack(i);
	}

});


$('#previous-button').on('click', function () {

	if(!shuffle){
		if(i==0){
			i=playlist.length-1;
		}
		else{
			i--;
		}
	}
	else{
		lastPlayed.pop();
		i = lastPlayed.pop();
	}

	if(i==undefined || i<0){
		i = 0;
	}

	playTrack(i);

});

$('#play-button').on('click', function(){
	wavesurfer.play();
});

$('#pause-button').on('click', function () {
	wavesurfer.playPause();
});

$('#stop-button').on('click', function(){
	wavesurfer.stop();
});

//Shuffle .
$('#shuffle-button').on('click', function(){
	var that = $(this);

	if(that.hasClass('active')){
		that.removeClass('active');
		that.attr('title', 'Shuffle off');
		shuffle = false;
	}
	else{
		that.addClass('active');
		that.attr('title', 'Shuffle on');
		shuffle = true;
	}
});

// repeat = 0 Без повтора
// repeat = 1 Повторение playlistа
// repeat = 2 Повторение текущего трека
$('#repeat-button').on('click', function(){

	var that = $(this);

	if(repeat==0){
		that.addClass('active');
		that.attr('title', 'Repeat all');
		repeat = 1;
	}

	else if(repeat==1){
		that.find('span').show();
		that.attr('title', 'Repeat current');
		repeat = 2;
	}

	else if(repeat==2){
		that.find('span').hide();
		that.removeClass('active');
		that.attr('title', 'Repeat off');
		repeat = 0;
	}

});


/**
 * Управление Playlist-ом
 */

// Открытие, закрытие playlist.
$('#track-details #show-list').on('click', function () {
	var expandBar = $('#expand-bar');

	if(expandBar.hasClass('hidden')){
		expandBar.removeClass('hidden');
		$(this).attr('title', 'Hide Playlist');
	}
	else{
		expandBar.addClass('hidden');
		$(this).attr('title', 'Show Playlist');
	}
});

$('#playlist').on('click', function (e) {

	var target = $(e.target),
		index = target.closest('.track').data('index');

	if(index!=undefined){

		if(!target.hasClass('remove-track')){

			i = index;

			playTrack(i);

		}
		else{

			var position,
				track = playlist[index];

			position = allTracks.indexOf(track);

			if(position != -1) {
				allTracks.splice(position, 1);
			}

			position = playlist.indexOf(track);

			if(position != -1) {
				playlist.splice(position, 1);
			}

			if (track.playing) {
				if (i >= playlist.length) {
					i = 0;
				}

				playTrack(i);
			}


			if(!playlist.length){
				if(allTracks.length){
					playlist = allTracks.slice(0);
					renderTrackList(playlist);
					i = 0;
					playTrack(i);
				}
				else{
					wavesurfer.empty();
					clearInterval(timer);
					$('#cover-art-big').css("background", "");
					$('#expand-bar').addClass('hidden');
					$('#track-desc').html('No tracks');
					$('#current').text('-');
					$('#total').text('-');
					$('#container').addClass('disabled');

					startPlayerWhenReady()
				}
			}

		}
	}

});


// Закрывает playlist если клик на картинку.
$('#container').on('click', function (e) {
	if(e.target==this){
		$('#expand-bar').addClass('hidden');
	}
});


/**
 * Вспомогательные функции
 */

//Автоматически запускает плейер когда файл загружен полностью.
function startPlayerWhenReady(){


	var interval = setInterval(function () {
		if(playlist[0]){
			playTrack(0);
			$('#container').removeClass('disabled');
			clearInterval(interval);
		}
	},200);
}


// Создает html для трека.
function returnTrackHTML(song, index){

	var html = '<li class="track';

	if(song.playing){
		html+= ' active'
	}

	html+='" data-index="'+ index +'">' +
	'<div>' +
	'<span class="overlay"><i class="fa fa-play"></i></span>' +
	'<img src="' + song.picture + '"/>' +
	'</div>' +
	'<div>'	+
	'<p class="title">' + song.title + '</p>' +
	'<p class="artist">' + song.artist + '</p>' +
	'<span title="Remove Track From Player" class="remove-track">×</span>' +
	'</div>' +
	'</li>';

	return html;
}


// Записывает содержимое playlist в html.
function renderTrackList(list){
	$('.track').remove();

	var html = list.map(function (tr,index) {
		return returnTrackHTML(tr,index);
	}).join('');

	$('#list').append($(html));
}


// Форматирование времени minutes:seconds.
function formatTime(time){
	time = Math.round(time);

	var minutes = Math.floor(time / 60),
		seconds = time - minutes * 60;

	seconds = seconds < 10 ? '0' + seconds : seconds;

	return minutes + ":" + seconds;
}


$(window).on('resize', function(){
	if($('#wave').is(":visible")) {
		wavesurfer.drawer.containerWidth = wavesurfer.drawer.container.clientWidth;
		wavesurfer.drawBuffer();
	}
});


// Подключение эквалайзера
$('#track-equalize').on('click', function() {
    var selector = document.getElementById('equalizer'),
        type = selector.options[selector.selectedIndex].value;

    var createFilter = function (frequency) {
        var filter = wavesurfer.backend.ac.createBiquadFilter();

        filter.type = 'peaking';
        filter.frequency.value = frequency;
        filter.Q.value = 1;
        filter.gain.value = 0;

        return filter;
    };

    var createFilters = function () {
        var frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000],
            filters = frequencies.map(createFilter);

        var gain_values;
        switch (type) {
            case 'pop': gain_values = [0, 0, 0, 0, 1, 1, 0, 0, 0, 0]; break;    //выделение голоса
            case 'rock': gain_values = [0, 0, 0, 0, 1, 1, 0, 0, 0, 0]; break;   //электрогитара
            case 'jazz': gain_values = [1, 1, 0, 0, 1, 1, 0, 0, 1, 1]; break;   //басы и верхние, голос
            case 'classic': gain_values = [0, 0, 1, 1, 1, 1, 0, 0, 0, 0]; break;    //в центре диапазона
            case 'normal': gain_values = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; break;
        }

        for (i = 0; i < filters.length; i++) {
            filters[i].gain.value = gain_values[i];
        }
        return filters;
    };

    var filters = createFilters();
    wavesurfer.backend.setFilters(filters);
});