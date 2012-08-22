# stencil

stencil is a templating engine designed by Andy VanWagoner
([thetalecrafter](http://github.com/thetalecrafter))
to enable templates to run in an environment with asynchronous I/O,
such as [node](http://nodejs.org), as well as in the browser.

While there have been many other libraries with the same claims,
all of the ones currently maintained use the mustache syntax,
while this uses asp / erb / php style syntax.

## Features

  * Async nested templates
  * Async tag to ensure template is processed sequentially
  * Use the same template code both server and client side


## Shared templates

The motivator for stencil was to share templates between server and client code.
The template can be used server side to generate a widget in the initial page load,
and then the template can be included on the page to update the widget.

The code to generate and update a widget can be the same file.


## Usage - template code

Templates are specified using php/asp syntax, with code inside special tags.
By default the tags are php-style:

```php
<? javascript code here ?>
```

There are also suffixes to the opening tag for ouput, include, and async blocks.

```php
<?= 'Today is ' + (new Date()) // result is html encoded and included in output ?>
<?= 'hello', ' ', 'world' // multiple results can be output ?>
<?- '<em>Important</em>' // This output won't be encoded ?>

<?# 'child-template-id' // result passed as id to include() ?>
<?# { id:'child', async:'~' }, { custom:'data' } // override options and data variables in child template ?>

<?! setTimeout(next, 1000); // functionally equivalent to php sleep(1) ?>
<?! someAsyncFunction(param1, function whendone(result) {
		// do stuff with result
		print(result);
		next(); // continue processing the rest of the template
	}); ?>
```

Members of the data object are put in the scope of the template code:

```html
<script type="text/template" id="template"><[CDATA[
	Why I don't teach English anymore:
	<?= message ?>.
]]></script>
<script>
	stencil({ id:'template' }, { message:'The book is not on the table' },
		function(err, result) {
			if (err) return console.log('The template failed to run.');
			console.log('The template result was:' + result);
		}
	);
</script>
```


Important note:

Unlike regular code tags, async tags cannot not include partial statements.
All of the code inside will be wrapped into a function, and will be executed
after the main block completes.

This would not work:

```php
<?! if (true) { ?>some output<? } ?>
```

Since compiled it would be similar to:

```javascript
async(function(next){ if (true) { }); print('some output'); }
```

```php
<? alert('This executes first'); ?>
<?! alert('This executes third, after the main block completes'); next(); ?>
<?! alert('fourth'); next(); ?>
<? alert('second'); ?>
```


## Usage - client side

```html
<script src="stencil.js"></script>
<script type="text/template" id="dom_id">
	<[CDATA[
	... template code here ...
	]]>
</script>
<script>
	stencil('dom_id', { data:object }, function(err, result) {
		/* all done */ 
		if (err) { /* you broke it */ return; }
		/* use the result */
	});

	// or

	stencil.fetch({ id:'dom_id' }, function(err, template) {
		template = stencil.compile(template, { async:'~' });
		template(
			{ data:object },
			function(data) { /* optional - use the data chunks */ },
			function(err, result) { /* all done */ },
		);
	});
</script>
```


## Usage - server side

```javascript
var stencil = require('./stencil');

stencil('/path/to/template', { data:object },
	function(data) { /* use the data chunks */ },
	function(err, result) { /* all done */ }
);

// same variations apply as client side.
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
	nest:  ' include this template:',
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
He looks like: ` include this template: 'looks_like', pet `.
`@my_async_function(function(result) { print(result); next(); });`
the end.
```


## Usage - extras

You can fetch templates synchronously, if you need to. The caveat here
is that you cannot do anything asynchronous in your template, or
you will only get the ouput up until the first asynchronous part. The setting
really only makes includes happen synchronously.

```javascript
try { var result = stencil({ id:'id', sync_include:true }, data); }
catch (err) { /* You broke it. */ }
```

Or if you have don't get the template by dom id, ajax call, (or by filename
in node), you can pass in the 'fetch' option a function that retrieves
the template text and has this signature: (stencil_options, next(error, text))


You can also compile templates without a 'with' statement, by including a
reference to uglify-js's parse function. This will improve the rendering
performance, but is expensive at compile time.

```javascript
stencil.compile({ id:'id', parse:require('uglify-js').parser.parse }, function(err, fn) {
	// fn does not use the 'with' statement, but still can't "use strict";
})
```

Removing the 'with' statement also means all variables in your template
are declared with 'var', so you can't create implicit globals, and you
won't get errors by using a context variable that wasn't passed in.

```php
<?
	// data passed in does not contain either variable
	bogus_var = 'bogus'; // won't implicitly create a global
	if (maybe_var) { // won't throw an error
		/* use maybe_var */
	}
?>
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

