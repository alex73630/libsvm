#!/usr/bin/env node
'use strict';

const Table = require('cli-table');
const spawn = require('child_process').spawn;
const argv = process.argv.slice(2);
let benchmarks = argv[0];

let modes = argv[1];
console.log(modes, benchmarks);
if(benchmarks === 'all') benchmarks = ['iris/cross-validation', 'iris/grid-search'];
else benchmarks = benchmarks.split(',');
if(modes === 'all') modes = ['native', 'asm', 'wasm'];
else modes = modes.split(',');

const time = +argv[2] || 10;

if(modes.includes('asm') || modes.includes('wasm')) {
    console.log('Running benchmark on nodejs version', process.version, '\n');
}

const table = new Table({
    head: [`Benchmark: # iterations in ${time} seconds`].concat(modes)
});

function toPercent(n, max) {
    const perc = n / max * 100;
    return '' + n + ' (' + perc.toFixed(1) + '%)';
}

async function exec() {
    for(let benchmark of benchmarks) {
        let counts = [];
        for (let mode of modes) {
            counts.push(await run(mode, time, benchmark));
            console.log('\n');
        }
        const max = Math.max.apply(null, counts.filter(c => typeof c === 'number'));
        counts = counts.map(c => typeof c === 'number' ? toPercent(c, max): c)
        table.push([benchmark, ...counts]);
    }
    console.log(table.toString());
}

async function run(mode, time, benchmark) {
    let count = 0;
    console.log(mode, benchmark);
    const runBenchmark = require(`./${benchmark}-benchmark`);
    let SVM;
    if(mode === 'asm') {
        SVM = require('../asm');
    }
    else if(mode === 'wasm') {
        try {
            SVM = await require('../wasm');
        } catch(e) {
            return 'error';
        }

    }
    else if(mode === 'native') {
        let str = '';
        const prom = new Promise((resolve, reject) => {
            const [dir, exec] = benchmark.split('/');
            const cmd = `${__dirname}/${dir}/bin/${exec}`;
            const args = [`${__dirname}/${dir}/data.txt`, time];
            console.log(cmd);
            const child = spawn(cmd, args);
            child.on('close', function() {
                resolve();
            });
            child.on('error', function() {
                reject(new Error(`Could not execute ${cmd} ${args}`));
            });
            child.stdout.on('data', data => str += data);
            child.stdout.pipe(process.stdout);
        });

        try {
            await prom;
            count = +/(\d+) iteration/.exec(str)[1];
        } catch(e) {
            console.error('error executing benchmark', e.message);
            return e.message;
        }
        return count;

    }
    else {
        console.log(`Unknown mode ${mode}`);
        return;
    }

    try {
        count = runBenchmark(SVM, time);
    } catch(e) {
        console.error('error executing benchmark', e.message);
        return e.message;
    }
    console.log(`Done. ${count} iterations in ${time} seconds.`);
    return count;
}

exec();


