# stencil

stencil is a templating engine designed by Andy VanWagoner
([thetalecrafter](http://github.com/thetalecrafter))
to enable templates to run in an environment with asynchronous I/O,
such as [node](http://nodejs.org), as well as in the browser.

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
<?= 'Today is ' + (new Date()) // result included in output ?>
<?= 'hello', ' ', 'world' // multiple results can be output ?>

<?# 'child-template-id' // result passed as id to include() ?>
<?# 'child', { custom: 'data' } // a separate data object in child ?>

<?! setTimeout(output.resume, 1000); // functionally equivalent to php usleep(1000) ?>
<?! someAsyncFunction(param1, function whendone(result) {
		// do stuff with result
		output.echo(result);
		output.resume(); // continue processing the rest of the template
	}); ?>
```

Members of the data object passed to exec are in the scope of the template code:

```html
<script type="text/template" id="template"><[CDATA[
	Why I don't teach English anymore:
	<?= message ?>.
]]></script>
<script>
	(new Template({ id:'template' })).exec({
		message: 'The book is not on the table'
	}, function(err, result) {
		if (err) { console.log('it didn\'t work'); return; }
		document.body.innerHTML += result;
	});
</script>
```


Some notes to remember:

1. The code in the output and include tags must be a comma separated list of expressions.
2. If only one expression is in the include tag,
the parent template's data object is passed to the child template.
3. Otherwise the second expression in the include tag will be passed to the child template as data.
4. Additional expressions in the include tag will be ignored.
5. Unlike regular code tags, async tags cannot not include partial statements.
All of the code inside will be wrapped into a function.
All of the code following will also be wrapped into a function.

This would not work:

```php
<?! if (true) { ?>some output<? } ?>
```

Since compiled it would be similar to:

```javascript
(function(){ if (true) { })(function() { output.echo('some output'); } });
```


## Usage - client side

```html
<script src="Template.js"></script>
<script type="text/template" id="dom_id">
	<[CDATA[
	... template code here ...
	]]>
</script>
<script>
	(new Template({ id:'dom_id' }).exec({ data:object }, {
		onerror:function(err) { /* you broke it */ }
		ondata:function(data) { /* use the data chunks */ }
		onend:function() { /* all done */ }
	});

	// or

	(new Template({ id:'dom_id' }).exec({ data:object }, function(err, result) {
		/* all done */ 
		if (err) { /* you broke it */ return; }
		/* use the result */
	});
</script>
```


## Usage - server side

```javascript
var Template = require('./Template').Template;

(new Template({ id:'/path/to/template' }).exec({ data:object }, {
	onerror:function(err) { /* you broke it */ }
	ondata:function(data) { /* use the data chunks */ }
	onend:function() { /* all done */ }
});

// or

(new Template({ id:'/path/to/template' }).exec({ data:object }, function(err, result) {
	/* all done */ 
	if (err) { /* you broke it */ return; }
	/* use the result */
});
```


## Usage - custom tags

```javascript
// set for all templates
// Template.prototype.start = ...

// set on a particular template
var t = new Template({ id:id });
t.start = '`';
t.stop  = '`';
t.echo  = 'print';
t.nest  = ' include this template:';
t.async = '@';

// template code:
My pet is `if (hungry) { `hungry` } else { `sleepy` }`.
His name is: `print pet.name`.
He looks like: ` include this template: 'looks_like', pet `.
`@my_async_function(function(result) { output.echo(result); output.resume(); });`
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

