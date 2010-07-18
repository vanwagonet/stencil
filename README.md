# stencil

stencil is a templating engine designed by Andy VanWagoner
([thetalecrafter](http://github.com/thetalecrafter))
to enable templates to run in an environment with asynchrounous I/O,
such as [node](http://nodejs.org).

## Features

  * Async nested templates.
  * Async tag to ensure template is processed sequentially.

## API Documentation

Read api documentation online at [github](http://thetalecrafter.github.com/stencil/docs/).

## Usage

Templates are specified using php/asp syntax, with code inside special tags.
By default the tags are php-style:

	<? javascript code here ?>

There are also suffixes to the opening tag for ouput, include, and async blocks.

	<?= 'Today is ' + (new Date()) /* result included in output */ ?>
	<?= 'hello', ' ', 'world' /* multiple results can be output */ ?>
	
	<?# 'child-template-id' /* result passed as id to include() */ ?>
	<?# 'child', { custom: 'data' } /* a separate data object in child */ ?>
	
	<?! setTimeout(resume, 1000); /* functionally equivalent to php's usleep(1000) */ ?>
	<?! someAsyncFunction(param1, function whendone(result) {
			// do stuff with result
			template.echo(result);
			resume(); // continue processing the rest of the template
		}); ?>

Some notes to remember:

1. The code in the output and include tags must be a comma separated list of expressions.
2. If only one expression is in the include tag,
the parent template's data object is passed to the child template.
3. Otherwise the second expression in the include tag will be passed to the child template as data.
4. Additional expressions in the include tag will be ignored.
5. Unlike regular code tags, async tags cannot not include partial statements.
All of the code will be wrapped into a single function.


## Major TODOs

  * More detailed examples
  * Determine api direction (Hopefully with community input)
  * Write test cases

## License 

(The MIT License)

Copyright (c) 2010 Andy VanWagoner

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
