# vim-rule-switcher

This Vim plugin provides a convenient way to switch between related files based
on custom rules. It's particularly useful in projects where files of different
types or with different naming conventions are logically related, such as header
and implementation files in C/C++ projects, or component and test files in web
development.

## Features

- Define custom switching rules based on file paths, prefixes, and postfixes.
- Easily navigate between related files with a simple Vim command.
- Supports integration with Git to switch between files tracked in the
  repository.

## Requirements

- [denops.vim](https://github.com/vim-denops/denops.vim)

## Installation

You can install vim-rule-switcher using your favorite plugin manager. For
example, with [vim-plug](https://github.com/junegunn/vim-plug):

```vim
Plug 'nekowasabi/vim-rule-switcher'
```

Then run `:PlugInstall` in Vim.

## Configuration

Define your switching rules in your `.vimrc` or `init.vim` like so:

```vim
let g:switch_rule = {
  \ 'conditions': [
  \   {
  \     'rule': 'file',
  \     'path': ['/path/to/code.ts', '/path/to/tests/codeTest.ts'],
  \     'postfix': '_test.ts',
  \     'prefix': '',
  \   },
  \   {
  \     'rule': 'git',
  \     'path': ['%_spec.ts', '%.ts'],
  \     'postfix': '_spec.ts',
  \     'prefix': '',
  \   },
  \ ]
  \}
```

## Usage

To switch between files according to the defined rules, use the following Vim
command:

```vim
:SwitchFileByRule
```

Optionally, you can pass an argument to specify the type of switch, such as
'git' to switch between files tracked by Git:

```vim
:SwitchFileByRule git
```

## TODO

- [ ] Integrate [ddu](https://github.com/Shougo/ddu.vim)

## Related Projects

[vim-altr](https://github.com/kana/vim-altr)

## License

typo

This project is licensed under the MIT License - see the LICENSE file for details.
