var ongoingTouches = [];
var fullWordList = [];
var wordList = [];
var pattern;
var patternCacheIdx;
var themeColor;
var wordj = "";
var word = [];
var positionLookup = [];
var hitIdx = [];
var offsetTop = 0;
var offsetLeft = 0;
var currentUser;
var bonusWords = [];
var totalBonusWords = 0;
var lwords = [];
var HINT_COST = 25,
	FREE_MONEY = 40;

var seed = 1;

function syncUser() {
	if (!localStorage.getItem("woordfuunUser")) {
		currentUser = {
			username: "baa",
			level: 0,
			answers: [],
			money: FREE_MONEY
		};
	}

	if (currentUser === undefined) {
		currentUser = JSON.parse(localStorage.getItem("woordfuunUser"));

		if (currentUser.level === undefined) {
			currentUser.level = 0;
		}

		if (currentUser.money === undefined) {
			currentUser.money = FREE_MONEY;
		}

		if (currentUser.answers === undefined) {
			currentUser.answers = [];
		}

		if (currentUser.table === undefined) {
			currentUser.table = {};
			currentUser.table_max_x = 0;
			currentUser.table_max_y = 0;
		}
		return;
	}

	localStorage.setItem("woordfuunUser", JSON.stringify(currentUser));
}

function main() {
  fetch("wordlists/comanche.json")
    .then(function(response) {
      if (!response.ok) {
        throw new Error("HTTP error, status = " + response.status);
      }
      return response.json();
    })
    .then(function(json) {
      wordList = json.words;
      fullWordList = json.words; // use same list for now
      startup();
    });
}

function markAnswerFound(word) {
	for (var a = 0; a < currentUser.answers.length; a++) {
		if (currentUser.answers[a].answer == word) {
			currentUser.answers[a].found = true;
		}
	}
	updateMoney(3);
	syncUser();
}

function wisselWords() {
	shuffle(word);
	clear();
}

function showHint() {
	updateMoney(-HINT_COST);
	renderTable({ hint: true });
}

function showBonusWords() {
	//MicroModal.show('modal-1');
	//setTimeout(function(){ MicroModal.close('modal-1'); }, 1000)
	contents = '<ul id="bonuslist">';
	for (var i = 0; i < bonusWords.length; i++) {
		contents += "<li>" + bonusWords[i] + "</li>";
	}
	contents += "</ul>";

	Swal.fire({
		title: "Bonus Woorden",
		html: contents
		//type: 'error',
		//confirmButtonText: 'Cool'
	});
}

function updateThemeColor() {
	if (Math.floor(currentUser.level / 10) == patternCacheIdx) {
		return;
	}

	pattern = Trianglify({
		width: window.innerWidth,
		height: window.innerHeight,
		seed: Math.floor(currentUser.level / 10)
	});
	document.body.style.backgroundImage = "url('" + pattern.png() + "')";

	var ra = 0,
		rb = 0,
		rg = 0;

	for (var i = 0; i < pattern.opts.x_colors.length; i++) {
		ra += parseInt(pattern.opts.x_colors[i].substring(1, 3), 16);
		rg += parseInt(pattern.opts.x_colors[i].substring(3, 5), 16);
		rb += parseInt(pattern.opts.x_colors[i].substring(5, 7), 16);
	}
	for (var i = 0; i < pattern.opts.y_colors.length; i++) {
		ra += parseInt(pattern.opts.y_colors[i].substring(1, 3), 16);
		rg += parseInt(pattern.opts.y_colors[i].substring(3, 5), 16);
		rb += parseInt(pattern.opts.y_colors[i].substring(5, 7), 16);
	}

	ra /= pattern.opts.x_colors.length + pattern.opts.y_colors.length;
	rg /= pattern.opts.x_colors.length + pattern.opts.y_colors.length;
	rb /= pattern.opts.x_colors.length + pattern.opts.y_colors.length;

	hsl = rgbToHsl(ra, rg, rb);
	h2 = (hsl[0] + 0.5) % 1;
	themeColor = hslToRgb(h2, Math.min(1, 2 * hsl[1]), Math.min(0.3, hsl[2]));

	patternCacheIdx = Math.floor(currentUser.level / 10);
}

function buildCrossword() {
	var input_json = [];
	for (var i = 0; i < lwords.length; i++) {
		input_json.push({ answer: lwords[i] });
	}
	var layout = generateLayout(input_json);
	return layout.result;
}

function regenerateLevel() {
	answers = buildCrossword();

	for (var a = 0; a < answers.length; a++) {
		answers[a].startx -= 1;
		answers[a].starty -= 1;
	}

	var table_max_x = 0,
		table_max_y = 0;

	for (var i = 0; i < answers.length; i++) {
		if (answers[i].orientation == "down") {
			pos = answers[i].starty + answers[i].answer.length;
			if (pos > table_max_y) {
				table_max_y = pos;
			}
		}

		if (answers[i].orientation == "across") {
			pos = answers[i].startx + answers[i].answer.length;
			if (pos > table_max_x) {
				table_max_x = pos;
			}
		}
	}
	currentUser.answers = answers;

	var table = {};
	// build empty table
	for (var r = 0; r < table_max_y; r++) {
		for (var c = 0; c < table_max_x; c++) {
			table[r + "," + c] = { blank: true, text: " ", found: false };
		}
	}

	currentUser.table_max_x = table_max_x;
	currentUser.table_max_y = table_max_y;
	currentUser.table = table;
	syncUser();
}

function startup(opts) {
	// Obtain user's info + sync
	syncUser();
	// Reset some variables
	bonusWords = [];

	// Resize canvas (if needed)
	var p = document.getElementById("canvas");
	w = document.body.clientWidth * 0.7;
	p.width = w;
	p.height = w;
	p.style = "height: " + w + "px;";

	var el = document.getElementsByTagName("canvas")[0];
	el.addEventListener("touchstart", handleStart, false);
	el.addEventListener("touchend", handleEnd, false);
	el.addEventListener("touchcancel", handleCancel, false);
	el.addEventListener("touchmove", handleMove, false);
	console.log("initialized.");

	updateThemeColor();

	// Seed predictably
	randomSetSeed(currentUser.level);
	updateMoney(0);

	document.getElementById("hint").innerHTML = "Hint (" + HINT_COST + "€)";

	// Pick out a word that's seven letters long
	letters7 = wordList.filter(word => word.length == 7);
	setTitle("Level " + (currentUser.level + 1) + " / " + letters7.length);

	// get the word for this level
	wordj = letters7[currentUser.level];
	word = wordj.split("");
	shuffle(word);

	totalBonusWords = 0;
	invalid_subsets = subsets(word);
	valid_subsets = only5k(invalid_subsets);
	if (level % 2 == 0) {
		valid_subsets = valid_subsets.filter(word => word.length > 3);
	}

	for (var q = 0; q < invalid_subsets.length; q++) {
		if (fullWordList.includes(invalid_subsets[q]) && !wordList.includes(invalid_subsets[q])) {
			totalBonusWords += 1;
		}
	}
	// Top N?
	shuffle(valid_subsets);
	lwords = [wordj].concat(
		valid_subsets
			.filter(function(w) {
				return w != wordj;
			})
			.slice(0, 9)
	);
	console.log(lwords);

	// Only rebuild the level if it's coming from a user beating the level, not
	// if it's coming from initial load
	if ((opts !== undefined && opts.levelUpdate) || currentUser.answers.length == 0) {
		regenerateLevel();
	}

	renderTable();
	offsetTop = document.getElementsByTagName("canvas")[0].offsetTop;
	offsetLeft = document.getElementsByTagName("canvas")[0].offsetLeft;
	clear(true);
}

function renderTable(opts) {
	var el = document.getElementById("crossword");
	el.innerHTML = "";

	for (var i = 0; i < currentUser.answers.length; i++) {
		a = currentUser.answers[i];
		r = a.starty + 0;
		c = a.startx + 0;

		for (var x = 0; x < a.answer.length; x++) {
			key = r + "," + c;

			found = currentUser.table[key].found || a.found || false;

			if (opts !== undefined && !found && opts.hint == true) {
				found = true;
				currentUser.table[key].found = true;
				opts.hint = false;
			}

			currentUser.table[key] = { blank: false, text: a.answer[x], found: found };

			if (a.orientation == "down") {
				r += 1;
			} else {
				c += 1;
			}
		}
	}

	tbl = document.createElement("table");

	for (var r = 0; r < currentUser.table_max_y; r++) {
		tr = document.createElement("tr");
		for (var c = 0; c < currentUser.table_max_x; c++) {
			td = document.createElement("td");
			key = r + "," + c;

			if (!currentUser.table[key].blank) {
				td.style = "background: " + themeColor + "cc";
				if (currentUser.table[key].found) {
					td.className = "solved";
				}
				td.innerHTML = currentUser.table[key].text;
			}

			tr.appendChild(td);
		}
		tbl.appendChild(tr);
	}

	el.appendChild(tbl);

	// identify available area
	total_height = 0.45 * document.body.clientHeight;
	total_width = document.body.clientWidth * 0.9;

	// Retain proportions
	if (currentUser.table_max_x / currentUser.table_max_y > total_width / total_height) {
		scale = total_width / currentUser.table_max_x;
	} else {
		scale = total_height / currentUser.table_max_y;
	}

	tmp_tbl_height = scale * currentUser.table_max_y;
	tmp_tbl_width = scale * currentUser.table_max_x;
	tbl.width = tmp_tbl_width;
	document.getElementsByTagName("table")[0].style = "height: " + tmp_tbl_height + "px";
}

function clear(complete, highlight) {
	positionLookup = [];
	var el = document.getElementsByTagName("canvas")[0];
	var ctx = el.getContext("2d");
	ctx.font = "30px 'Charis SIL', serif";
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	if (complete) {
		ongoingTouches = [];
	}

	center = w / 2;
	halfwidth = (0.7 * w) / 2;
	for (var i = 0; i < word.length; i++) {
		x = Math.cos((2 * Math.PI * i) / word.length - Math.PI / 2);
		y = Math.sin((2 * Math.PI * i) / word.length - Math.PI / 2);

		rx = center + x * halfwidth;
		ry = center + y * halfwidth;

		positionLookup.push({ letter: word[i], x: rx, y: ry });

		ctx.beginPath();
		ctx.arc(rx, ry, 30, 0, 2 * Math.PI);

		if (hitIdx !== undefined && hitIdx.includes(i)) {
			// will highlight somewhat.
			if (highlight !== undefined && highlight == i) {
				ctx.fillStyle = "hsl(" + 360 * (hitIdx.indexOf(i) / word.length) + ",100%, 50%)";
			} else {
				ctx.fillStyle = "hsl(" + 360 * (hitIdx.indexOf(i) / word.length) + ",50%, 50%)";
			}
		} else {
			ctx.fillStyle = themeColor + "cc";
		}
		ctx.fill();

		ctx.fillStyle = "white";
		ctx.fillText(word[i], rx - 10, ry + 10);
	}

	if (highlight) {
		redrawSegments();
	}

	if (complete) {
		hitIdx = [];
	}
}

function handleStart(evt) {
	evt.preventDefault();
	//log("touchstart.");
	var el = document.getElementsByTagName("canvas")[0];
	var ctx = el.getContext("2d");
	var touches = evt.changedTouches;

	for (var i = 0; i < touches.length; i++) {
		ongoingTouches.push(copyTouch(touches[i]));
		ctx.beginPath();
		ctx.arc(touches[i].pageX, touches[i].pageY, 4, 0, 2 * Math.PI, false); // a circle at the start
		ctx.fillStyle = "black";
		ctx.fill();
	}
}

function detectHit(x, y) {
	for (var i = 0; i < positionLookup.length; i++) {
		d = distance(x, y, positionLookup[i].x, positionLookup[i].y);
		if (d < 50) {
			// Ok we have a hit
			if (hitIdx.includes(i)) {
				// already been here
				return;
			}
			hitIdx.push(i);

			clear(false, i);
		}
	}
}

function drawSegment(ctx, x1, y1, x2, y2, idx) {
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.lineWidth = 4;
	ctx.strokeStyle = "hsl(" + idx * 2 + ", 100%, 50%)";
	ctx.stroke();
}

function redrawSegments() {
	var el = document.getElementsByTagName("canvas")[0];
	var ctx = el.getContext("2d");

	for (var i = 0; i < ongoingTouches.length - 1; i++) {
		drawSegment(ctx, ongoingTouches[i].pageX, ongoingTouches[i].pageY, ongoingTouches[i + 1].pageX, ongoingTouches[i + 1].pageY, i);
	}
}

function handleMove(evt) {
	evt.preventDefault();
	var el = document.getElementsByTagName("canvas")[0];
	var ctx = el.getContext("2d");
	var touches = evt.changedTouches;

	for (var i = 0; i < touches.length; i++) {
		var idx = ongoingTouchIndexById(touches[i].identifier);

		var x = touches[i].pageX - offsetLeft,
			y = touches[i].pageY - offsetTop;

		if (idx >= 0) {
			detectHit(x, y);

			drawSegment(
				ctx,
				ongoingTouches[ongoingTouches.length - 1].pageX,
				ongoingTouches[ongoingTouches.length - 1].pageY,
				x,
				y,
				ongoingTouches.length
			);

			ongoingTouches.push(copyTouch(touches[i]));
		} else {
			console.log("can't figure out which touch to continue");
		}
	}
}

function handleEnd(evt) {
	evt.preventDefault();
	var el = document.getElementsByTagName("canvas")[0];
	var ctx = el.getContext("2d");
	var touches = evt.changedTouches;

	if (hitIdx.length > 0) {
		foundWord = "";
		for (var i = 0; i < hitIdx.length; i++) {
			foundWord = foundWord + word[hitIdx[i]];
		}

		v = validateWord(foundWord);

		if (v == 0) {
			// no word
			//flash? or sth
		} else if (v == 1) {
			// word but not answer
			findBonusWord(foundWord);
		} else if (v == 2) {
			// answer
			markAnswerFound(foundWord);
			renderTable();
		}
	}
	syncUser();
	updateMoney(0);
	finishLevelIfNeeded();
	clear(true);
}

function updateMoney(amount) {
	currentUser.money += amount;
	document.getElementById("hint").disabled = currentUser.money < HINT_COST;
	document.getElementById("money").innerHTML = currentUser.money + "€";

	buttons = document.getElementsByTagName("button");
	for (var b = 0; b < buttons.length; b++) {
		if (!buttons[b].disabled) {
			buttons[b].style.backgroundColor = themeColor + "cc";
		} else {
			buttons[b].style.backgroundColor = "#dddddd";
		}
	}
}

function findBonusWord(word) {
	if (bonusWords.includes(word)) {
		return;
	}

	if (word.length < 3) {
		return;
	}

	bonusWords.push(word);
	updateMoney(word.length);
	var el = document.getElementById("bonus");
	el.innerHTML = "Bonus (" + bonusWords.length + "/" + totalBonusWords + ")";
}

function finishLevelIfNeeded() {
	for (var q = 0; q < currentUser.answers.length; q++) {
		if (!currentUser.answers[q].found) {
			return;
		}
	}

	advanceLevel(4000);
}

function advanceLevel(timeout, levels) {
	Swal.fire({
		title: "🎉 Solved 🎉",
		text: "You solved it!",
		type: "success",
		timer: timeout
	});
	bonusWords = [];
	if (levels !== undefined) {
		currentUser.level += levels;
	} else {
		currentUser.level++;
	}
	startup({ levelUpdate: true });
}

function handleCancel(evt) {
	evt.preventDefault();
	var touches = evt.changedTouches;

	for (var i = 0; i < touches.length; i++) {
		var idx = ongoingTouchIndexById(touches[i].identifier);
		ongoingTouches.splice(idx, 1); // remove it; we're done
	}
	clear(true);
}

function copyTouch(touch) {
	var q = {
		identifier: touch.identifier,
		pageX: touch.pageX - offsetLeft,
		pageY: touch.pageY - offsetTop
	};
	return q;
}

function ongoingTouchIndexById(idToFind) {
	for (var i = 0; i < ongoingTouches.length; i++) {
		var id = ongoingTouches[i].identifier;

		if (id == idToFind) {
			return i;
		}
	}
	return -1; // not found
}

function main() {
	fetch("wordlists/nl.5000.json")
		.then(function(response) {
			if (!response.ok) {
				throw new Error("HTTP error, status = " + response.status);
			}
			return response.json();
		})
		.then(function(json) {
			wordList = json;

			fetch("wordlists/nl.full.json")
				.then(function(response) {
					if (!response.ok) {
						throw new Error("HTTP error, status = " + response.status);
					}
					return response.json();
				})
				.then(function(json2) {
					fullWordList = json2;

					startup();
				});
		});
	//.catch(function(error) {
	//alert(error.message);
	//});
}

main();
