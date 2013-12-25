
var canvas;
var ctx;

var i_max = 1.5;
var i_min = -1.5;
var r_min = -2.5;
var r_max = 1.5;

var max_iter = 1024;
var escape = 100;
var palette = [];


//
// packages up the data we need to send to the worker
//
function createTask(row) {
    var task = {
        row: row,               // row number we're working on
        width: rowData.width,   // width of the ImageData object to fill
        generation: generation, // how far in we are
        r_min: r_min,
        r_max: r_max,
        i: i_max + (i_min - i_max) * row / canvas.height,
        max_iter: max_iter,
        escape: escape
    };
    return task;
}
//
// This function maps the numbers 0 to max_iter to
// 256 and then fills the palette with (r, g, b) values
// so that the colors next to each other in the array
// are relatively close to each other in color, and
// by increasing each of r, g, b at a different rate this
// works well to fill the spectrum for max_iter > 256.
//
//
function makePalette() {
    function wrap(x) {
        x = ((x + 256) & 0x1ff) - 256;
        if (x < 0) x = -x;
        return x;
    }
    for (i = 0; i <= this.max_iter; i++) {
        palette.push([wrap(7*i), wrap(5*i), wrap(11*i)]);
    }
}

// drawRow gets maps the values in the array returned from a worker
//  for one row to a color using the palette.
//
function drawRow(workerResults) {
    var values = workerResults.values;  // The values array the worker sends back
    var pixelData = rowData.data;       // The actual pixels in the ImageData obj
    // The pixelData is a *reference* to the
    // rowData.data! so changing pixelData
    // changes the rowData.data!!!
    for (var i = 0; i < rowData.width; i++) {  // for each pixel in the row
        var red = i * 4;
        var green = i * 4 + 1;
        var blue = i * 4 + 2;
        var alpha = i * 4 + 3;

        pixelData[alpha] = 255; // set alpha to opaque

        // if the values array has a neg number, set the color to black
        if (values[i] < 0) {
            pixelData[red] = pixelData[green] = pixelData[blue] = 0;
        } else {
            //
            // map the number from the values array returned by the worker
            // to a color from the palette
            //
            var color = this.palette[values[i]];

            //
            // each color has an rgb component, so set the rgb of
            // the pixel we're working on to r,g,b.
            //
            pixelData[red] = color[0];
            pixelData[green] = color[1];
            pixelData[blue] = color[2];
        }
    }
    //
    // paint the row back into the canvas
    // workerData.row is the row number we're working on
    // rowData contains the data we just updated!
    // we start at column 0, so x, y = 0, row
    //
    ctx.putImageData(this.rowData, 0, workerResults.row);
}


//
// setupGraphics sets up some of the initial values for the variables used in
//   the Mandelbrot computation, and sets the canvas width and height
//   to the width and height of the window.
//

function setupGraphics() {

    canvas = document.getElementById("fractal");
    ctx = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var width = ((i_max - i_min) * canvas.width / canvas.height);
    var r_mid = (r_max + r_min) / 2;
    r_min = r_mid - width/2;
    r_max = r_mid + width/2;

    rowData = ctx.createImageData(canvas.width, 1);

    makePalette();
}




/*
 * mandel.js
 */

var numberOfWorkers = 8;
var workers = [];
var rowData;
var nextRow = 0;
var generation = 0;

window.onload = init;

function init() {
    setupGraphics();

    //
    // When you click on the canvas, the handler is called.
    // An event object is passed in that contains the
    // x, y position of the mouse click. We pass those
    // values to the click handler.
    //
    canvas.onclick = function(event) {
        handleClick(event.clientX, event.clientY);
    };
    //
    // When you resize the browser window, we need
    //  to resize the canvas and restart the workers.
    //
    window.onresize = function() {
        resizeToWindow();
    };

    //
    // Create all the workers and set up the message handler.
    //  Add each worker to the workers array.
    //
    for (var i = 0; i < numberOfWorkers; i++) {
        var worker = new Worker("/source/js/worker.js");

        worker.onmessage = function(event) {
            processWork(event.target, event.data)
        }

        worker.idle = true;
        workers.push(worker);
    }

    //
    // Start the workers
    //
    startWorkers();

}

//
// startWorkers
//  This function resets the workers to start them working
//      at the top of the fractal (row 0). It loops through
//      all the workers in the workers array and assigns
//      each worker a task to compute a row.
//  By posting a message with the task, we start the
//      worker's computation.
//
function startWorkers() {
    generation++;
    nextRow = 0;
    for (var i = 0; i < workers.length; i++) {
        var worker = workers[i];
        if (worker.idle) {
            var task = createTask(nextRow);
            worker.idle = false;
            worker.postMessage(task);
            nextRow++;
        }
    }
}

//
// processWork
//  This is the function we call when the worker posts
//      back a message with the results.
//  If the worker is working on the current fractal
//      generation, we draw the row of data, otherwise
//      we just throw the data away.
//  Once we've used the results, we assign the worker to
//      start computing another row.
//
function processWork(worker, workerResults) {
    if (workerResults.generation == generation) {
        drawRow(workerResults);
    }
    reassignWorker(worker);
}

//
// reassignWorker
//  This function gives an idle worker its next task.
//
function reassignWorker(worker) {
    var row = nextRow++;
    if (row >= canvas.height) {
        worker.idle = true;
    } else {
        var task = createTask(row);
        worker.idle = false;
        worker.postMessage(task);
    }
}


// handleClick
//  This function takes the x, y position where the user
//      clicked and sets the parameters for the new
//      fractal. The zoom factor sets the new extent
//      of the bounds of the Mandelbrot set to the
//      zoomed in size. The new fractal maintains
//      the aspect ratio of the current canvas size.
//  We start the workers over on the new zoomed in
//      fractal.
//
function handleClick(x, y) {
    var width = r_max - r_min;
    var height = i_min - i_max;
    var click_r = r_min + ((width * x) / canvas.width);
    var click_i = i_max + ((height * y) / canvas.height);

    var zoom = 8;

    r_min = click_r - width/zoom;
    r_max = click_r + width/zoom;
    i_max = click_i - height/zoom;
    i_min = click_i + height/zoom;

    startWorkers();
}

//
// resizeToWindow
//  When the user resizes the browser window,
//      this function is called to resize the canvas,
//      and reset the fractal parameters (changing the
//      extent of the boundary and maintaining the new
//      aspect ratio of the window).
//  We restart the workers to compute the new fractal
//      based on the new size.
//
function resizeToWindow() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var width = ((i_max - i_min) * canvas.width / canvas.height);
    var r_mid = (r_max + r_min) / 2;
    r_min = r_mid - width/2;
    r_max = r_mid + width/2;
    rowData = ctx.createImageData(canvas.width, 1);

    startWorkers();
}