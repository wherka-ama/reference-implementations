# Green Software plugin

An experimental [Agent Plugins 1.0.0](https://agent-plugins.org/specification)
package exposing the GSF [green-code-skill](./skills/green-code-skill/).
The root `plugin.json` declares metadata; skills are discovered from immediate
children of `skills/`. No custom component paths or legacy manifest are needed.

The package is self-contained and includes its MIT license. It does not expose
the repository's unrelated MCP implementation or dashboard. A conformant plugin
can provide skills without `mcp.json`; absent optional components are not errors.

Install this directory using a client that explicitly supports Agent Plugins
1.0.0. Package conformance does not imply that every agent CLI supports native
loading or the same activation behavior. See the skill's usage guides for manual
skill installation when native plugin support is unavailable.
