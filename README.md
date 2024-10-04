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

Make json file in `/path/to/example.json`.

```json
{
  "conditions": [
    {
      "name": "neovim_settings",
      "rule": "file",
      "path": [
        "~/.config/nvim/init.vim",
        "~/.config/nvim/rc/plugin.vim"
      ]
    },
    {
      "name": "unit_test",
      "rule": "file",
      "prefix": "Test",
      "postfix": "Test",
      "path": [
        "~/.config/nvim/rc/%.php",
        "~/.config/nvim/rc/%Test.php"
      ]
    }
  ]
}
```

Define your switching rules in your `.vimrc` or `init.vim` like so:

```vim
let g:switch_rule = readfile("/path/to/example.json")
```

## Usage

To switch between files according to the defined rules, use the following Vim
command:

```vim
:SwitchFileByRule
```

To add a new rule for the current file, use the following command:

```vim
:SaveSwitchRule <rule_name>
```

This command will add the current file to the specified rule in the switch rule
file.

To edit the rules file, use the following command:

```vim
:OpenSwitchRuleFile
```

To select a switch rule interactively, use the following command:

```vim
:SelectSwitchRule
```

This command allows you to choose from the available switch rules and apply the
selected rule to switch files.

## TODO

- [x] Integrate [ddu](https://github.com/Shougo/ddu.vim)
- [x] Enable use rules file.
- [x] Add config command.

## Related Projects

[vim-altr](https://github.com/kana/vim-altr)

## License

This project is licensed under the MIT License - see the LICENSE file for
details.
