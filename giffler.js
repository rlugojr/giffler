#!/usr/bin/env node

var os = require('os');
var fse = require('fs-extra');
var argv = require('yargs').argv;
var path = require('path');
var child = require('child_process');
var onDeath = require('death')({uncaughtException: false});

var programs = {
	ffmpeg: {
		win32: path.join(__dirname, 'libs', 'ffmpeg.exe'),
		any: 'ffmpeg'
	},
	convert: {
		win32: path.join(__dirname, 'libs', 'convert.exe'),
		any: 'convert'
	}
};

var opts = {
	tmp: path.join(os.tmpdir(), 'giffler-frames-'+randomInt()),
	input: argv.input? argv.input : null,
	output: argv.output || argv.input? path.basename(argv.input) + '.gif' : '',
	loops: argv.loops || 0,
	fps: argv.fps || 30,
	fuzz: argv.fuzz || 0.75, // lower means less artifacts bigger filesize
	dither: argv.dither? 'FloydSteinberg' : 'none',
	memory: argv.memory
};

if (opts.input) gif();
else fail('Missing input, use --input');
onDeath(function() {
	// TODO this isn't pretty
	// onDeath() attaches listeners, this causes fail() to trigger automatically
	console.log('Aborting giffler task...');
});

function gif() {
	removeTempDirectory();
	makeTempDirectory();
}

function removeTempDirectory() {
	fse.removeSync(opts.tmp);
}

function makeTempDirectory() {
	fse.mkdir(opts.tmp, function(err) {
		if (err) fail('Could not create a temporary directory.');
		makeFrames();
	});
}

function makeFrames() {
	var program = programs.ffmpeg[process.platform] || programs.ffmpeg.any;
	var args = [
		'-i', opts.input,
		'-vf',
		'fps=' + opts.fps,
		path.join(opts.tmp, 'f%07d.png')
	];

	console.log('Extracting frames...');
	child.execFile(program, args, function(err) {
		if (err) fail(err);
		makeGif()
	});
}

function makeGif() {
	var program = programs.convert[process.platform] || programs.convert.any;
	var args  = [
		opts.memory? '-limit memory ' + opts.memory + 'MiB' : '',
		'-delay ' + (100 / opts.fps),
		'-loop ' + opts.loops,
		path.join(opts.tmp, 'f*.png'),
		'-dither ' + opts.dither,
		'-fuzz ' + opts.fuzz + '%',
		'-coalesce',
		'-layers optimize',
		opts.output
	];

	// An empty argument '' can cause execFile to hang so remove them...
	args = args.filter(function(e) {return e;}).join(' ').split(' ');

	console.log('Making gif...');
	child.execFile(program, args, function(err) {
		if (err) fail('convert error: ' + err.toString());
		removeTempDirectory();
		console.log('Done!');
	});
}

function randomInt() {
	var low =   10000000000;
	var high =  100000000000;
	return Math.floor(Math.random() * (high - low) + low);
}

function fail(msg) {
	removeTempDirectory();
	console.error(msg);
	printHelp();
	process.exit(1);
}

function printHelp() {
	console.log('');
	console.log(' giffler!');
	console.log('');
	console.log('  required:');
	console.log('    --input <filename>');
	console.log('');
	console.log('  optional and their defaults:');
	console.log('    --fps 30');
	console.log('    --loops 0');
	console.log('    --fuzz 0.75');
	console.log('    --dither none');
	console.log('    --output <same as input plus .gif>');
	console.log('');
	console.log('  explained:');
	console.log('    --loops:');
	console.log('        the number of times the gif should loop');
	console.log('        zero means infinite');
	console.log('     --fuzz:');
	console.log('        number 0-100, representing a percentage');
	console.log('        colors near each other will be considered the same');
	console.log('        higher values cause more artifacts and lower file size');
	console.log('        recommended values are between 0.5 and 5');
	console.log('    --dither:');
	console.log('        opposite of --fuzz but they can be used together');
	console.log('        sprinkles the image with dots');
	console.log('        helps with gradients and photographs');
	console.log('        increases file size');
	console.log('        absent parameter means it\'s off');
	console.log('        tip: keep a low fuzz when using dither or they cancel each other');
}