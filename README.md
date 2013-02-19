# stencil

stencil is a templating engine designed by Andy VanWagoner
([thetalecrafter](http://github.com/thetalecrafter))
to enable templates to run in an environment with asynchronous I/O,
such as [node](http://nodejs.org), as well as in the browser.

If [ejs](https://github.com/visionmedia/ejs) suites your needs,
you should probably use that as it is better tested and is likely
more robust. However, stencil includes a few things that ejs
does't yet.

## Features

  * Async tag to ensure template is processed sequentially
  * Use the same template code both server and client side
  * Generate function as a string on server for use on the client
  * Choose to include "use strict"; or with(data) {...}
  * Line numbers in generated code match original template


## Install - npm

`npm install stencil-js`


## Usage - template code

Templates are specified using php/asp syntax, with code inside special tags.
There are also suffixes to the opening tag for print and async blocks.
By default the tags are php-style:

```php
<? javascript code here ?>
<?= 'Today is ' + (new Date()) /* result is html encoded and included in output */ ?>
<?= 'hello', ' ', 'world' /* multiple results can be output */ ?>
<?- '<em>Important</em>' /* This output won't be encoded */ ?>

<?! setTimeout(next, 1000); /* functionally equivalent to php sleep(1) */ !?>
<?! someAsyncFunction(param1, function whendone(result) {
		// do stuff with result
		print(result);
		next(); // continue processing the rest of the template
	}); !?>
```

Members of the data object are optionally put in the scope of the template code:

```html
<script type="text/template" id="template"><
	Why I don't teach English anymore:
	<?= message ?>.
</script>
<script>
	stencil({
		id: 'template',
		src: document.getElementById('sub').innerHTML,
		strict: false /* tells stencil to include a with(data) statement */
	}, { message:'The book is not on the table' },
		function(err, result) {
			if (err) return console.log('The template failed to run.');
			console.log('The template result was:' + result);
		}
	);
</script>
```

While nested templates are not built into the language it is easy to do so
with a small amount of custom code:

```javascript
// client (no async done in sub)
	<?- stencil(document.getElementById('sub').innerHTML, $) ?>
// server (sub can have async blocks)
	<?! fs.readFile('sub', 'utf8', function(err, tpl) {
		if (err) return next(err);
		stencil(tpl, $, next);
	}); !?>
```


Important note:

Make careful to put async blocks end tags at the same nesting level as the start.
All of the code inside will be wrapped into a function, and will be executed
after the main block completes.

```php
<?! if (works) { ?>a-okay<? } next(); !?>
<?! if (!works) { !?>broken<? } next(); ?>
```

Looks something like this after it is compiled:

```javascript
async(function(){ if (works) { print('a-okay'); } next(); });
async(function(){ if (!works) { }); print('broken'); } next();
```

```php
<? alert('1'); print('1'); ?>
<?! alert('3'); print('2'); next(); !?>
<?! alert('4'); print('3'); next(); !?>
<? alert('2'); print('4'); ?>
// alerts 1 then 2 then 3 then 4
// prints 1234
```


## Usage

`stencil(options, data, onprint, oncomplete)` returns output if no async blocks were used

`options` can be a template string or an object with these properties:
* `id` - usually the filename or uri, used for caching the resulting function for subsequent runs
* `src` - the template string
* `start` - default '<?', start tag in the template
* `stop` - default '?>', stop tag in the template
* `echo` - default '-', suffix for echoing result of the expression
* `safe` - default '=', suffix for echoing result of the expression html encoded
* `async` - default '!', suffix for async blocks, Output is still in document order
* `strict` - default true, start function with `"use strict";` or wrap function in `with(dataVar) {}`
* `dataVar` - default '$', name of object parameter containing data mambers to use in execution
* `chunkVar` - default '\u03B9', name of function parameter called when each chunk is ready
* `doneVar` - default '\u03DD', name of function parameter called when output is complete
* `outputVar` - default '\u03A3', name of string used to hold the output
* `safeVar` - default 'escape', name of function used to encode html characters
* `echoVar` - default 'print', name of function used to output strings
* `asyncVar` - default '\u03BB', name of function used internally on async blocks
* `nextVar` - default 'next', name of function to call when done with async block

`data` object containing values to use in template execution

`onprint(chunk)` - optional - function called for each chunk of output as it becomes ready

`oncomplete(err, output)` function called when template has completed


`stencil(options)` or `stencil.compile(options, string)` returns compiled function

`options` template string or options, see above

`string` - optional - if true, return compiled function as a string instead


## Usage - client side

```html
<script src="stencil.js"></script>
<script type="text/template" id="dom_id">
	... template code here ...
</script>
<script>
	stencil(document.getElementById('dom_id').innerHTML,
		{ /*data*/ }, function(err, result) {
		/* all done */ 
		if (err) { /* you broke it */ return; }
		/* use the result */
	});
</script>
```


## Usage - server side

```javascript
var stencil = require('./stencil');

stencil('Hello <?- $.whom ?>!', { whom:'World' },
	function(data) { /* use the data chunks */ },
	function(err, result) { /* all done */ }
);
```


## Usage - custom tags

```javascript

// override defaults for this template
stencil({
	id:    id,
	start: '`',
	stop:  '`',
	echo:  'print',
	safe:  'encode',
	async: '@'
}, data, function(err, result) {
	// here's my result
});

// or for all templates
stencil.defaults.start = '`';
stencil.defaults.stop  = '`';
...

// template code:
My pet is `if (hungry) { `hungry` } else { `sleepy` }`.
His name is: `print pet.name`.
`@my_async_function(function(result) { print(result); next(); });`
the end.
```


## License 

(The MIT License)

Copyright (c) 2012 Andy VanWagoner

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

