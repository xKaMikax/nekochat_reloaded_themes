#!/usr/bin/env python3
"""Patches the open SpaceCadetPinball port (alula/SpaceCadetPinball, commit 0bc12d3) for the Pinball add-on:
XP colours for its dialogs, no ImGui menu (the page draws an XP menu and calls nk_command), the high scores
and the end of a game go to JavaScript (Module.nkScore / Module.nkShowScores), and the position of the balls
and the table view are readable (nk_ball_*, nk_view) so the page can draw the opponent's ball.
Usage: apply_patches.py <path to the port's source root>   then build with build.sh."""
import sys, pathlib
root = pathlib.Path(sys.argv[1]); src = root / 'SpaceCadetPinball'

def edit(path, fn):
    text = path.read_text(); new = fn(text); assert new != text, path; path.write_text(new)

def sub(old, new, count=1):
    def run(text):
        assert old in text, old[:60]
        return text.replace(old, new, count)
    return run

def chain(*fns):
    def run(text):
        for fn in fns: text = fn(text)
        return text
    return run

edit(root / 'CMakeLists.txt', chain(sub(' -s DEMANGLE_SUPPORT=1', ''), sub('--bind', '--bind -s EXPORTED_RUNTIME_METHODS=ccall,cwrap')))
edit(src / 'winmain.h', sub('private:', 'public:'))
edit(src / 'render.h', sub('private:\n\tstatic int many_dirty', 'public:\n\tstatic int many_dirty'))

XP_STYLE = '''	ImGui::StyleColorsLight();
	{
		// Windows XP colours for the game's own dialogs.
		ImGuiStyle &st = ImGui::GetStyle();
		auto rgb = [](int r, int g, int b) { return ImVec4(r / 255.f, g / 255.f, b / 255.f, 1.f); };
		ImVec4 *c = st.Colors;
		c[ImGuiCol_Text] = rgb(0, 0, 0);
		c[ImGuiCol_TextDisabled] = rgb(172, 168, 153);
		c[ImGuiCol_WindowBg] = c[ImGuiCol_ChildBg] = c[ImGuiCol_PopupBg] = rgb(236, 233, 216);
		c[ImGuiCol_Border] = rgb(0, 60, 116);
		c[ImGuiCol_BorderShadow] = ImVec4(0, 0, 0, 0);
		c[ImGuiCol_FrameBg] = c[ImGuiCol_FrameBgHovered] = c[ImGuiCol_FrameBgActive] = rgb(255, 255, 255);
		c[ImGuiCol_TitleBg] = c[ImGuiCol_TitleBgActive] = rgb(0, 84, 227);
		c[ImGuiCol_TitleBgCollapsed] = rgb(122, 150, 223);
		c[ImGuiCol_MenuBarBg] = rgb(236, 233, 216);
		c[ImGuiCol_Button] = rgb(236, 233, 216);
		c[ImGuiCol_ButtonHovered] = rgb(255, 240, 207);
		c[ImGuiCol_ButtonActive] = rgb(226, 222, 205);
		c[ImGuiCol_Header] = rgb(193, 210, 238);
		c[ImGuiCol_HeaderHovered] = rgb(193, 210, 238);
		c[ImGuiCol_HeaderActive] = rgb(152, 180, 226);
		c[ImGuiCol_ScrollbarBg] = rgb(244, 242, 232);
		c[ImGuiCol_ScrollbarGrab] = rgb(200, 208, 240);
		c[ImGuiCol_CheckMark] = rgb(33, 161, 33);
		c[ImGuiCol_TableHeaderBg] = rgb(214, 210, 193);
		st.WindowRounding = st.FrameRounding = st.PopupRounding = st.ScrollbarRounding = st.GrabRounding = 0.f;
		st.WindowBorderSize = st.PopupBorderSize = st.FrameBorderSize = 1.f;
	}
'''
EXPORTS = '''
#ifdef __EMSCRIPTEN__
// Commands and readings for the page around the game (see Pinball's pinball.js).
extern "C"
{
	EMSCRIPTEN_KEEPALIVE void nk_hide_menu(int hide) { HideMenuBar = hide != 0; }
	EMSCRIPTEN_KEEPALIVE void nk_command(int id)
	{
		switch (id)
		{
		case 1: winmain::new_game(); break;
		case 2: winmain::end_pause(); pb::launch_ball(); break;
		case 3: winmain::pause(); break;
		case 4: pb::high_scores(); break;
		case 5: winmain::end_pause(); pb::toggle_demo(); break;
		case 6: options::toggle(Menu1::Sounds); break;
		case 7: options::toggle(Menu1::Music); break;
		case 8: if (!winmain::single_step) winmain::pause(); options::keyboard(); break;
		case 9: if (!winmain::single_step) winmain::pause(); winmain::ShowAboutDialog = true; break;
		case 11: options::toggle(Menu1::OnePlayer); winmain::new_game(); break;
		case 12: options::toggle(Menu1::TwoPlayers); winmain::new_game(); break;
		case 13: options::toggle(Menu1::ThreePlayers); winmain::new_game(); break;
		case 14: options::toggle(Menu1::FourPlayers); winmain::new_game(); break;
		}
	}
	// 1 sound, 2 music, 3 players, 4 demo, 5 paused
	EMSCRIPTEN_KEEPALIVE int nk_state(int id)
	{
		switch (id)
		{
		case 1: return options::Options.Sounds;
		case 2: return options::Options.Music;
		case 3: return options::Options.Players;
		case 4: return winmain::DemoActive;
		case 5: return winmain::single_step;
		}
		return 0;
	}
	// The balls in play: their centre and size in the table picture (vscreen) pixels.
	EMSCRIPTEN_KEEPALIVE int nk_ball_count() { return render::many_balls; }
	EMSCRIPTEN_KEEPALIVE int nk_ball_info(int index, int field)
	{
		if (index < 0 || index >= render::many_balls || !render::ball_list[index]) return 0;
		const auto &rect = render::ball_list[index]->BmpRect;
		switch (field)
		{
		case 0: return rect.XPosition + rect.Width / 2;
		case 1: return rect.YPosition + rect.Height / 2;
		case 2: return rect.Width;
		}
		return 0;
	}
	// Where the table picture is drawn in the window: 0..3 x, y, width, height; 4, 5 the picture's own size.
	EMSCRIPTEN_KEEPALIVE int nk_view(int field)
	{
		switch (field)
		{
		case 0: return render::DestinationRect.x;
		case 1: return render::DestinationRect.y;
		case 2: return render::DestinationRect.w;
		case 3: return render::DestinationRect.h;
		case 4: return render::vscreen.Width;
		case 5: return render::vscreen.Height;
		}
		return 0;
	}
	// The score of the player whose turn it is.
	EMSCRIPTEN_KEEPALIVE int nk_score_now()
	{
		auto table = pb::MainTable;
		if (!table || table->CurrentPlayer < 0 || table->CurrentPlayer > 3 || !table->PlayerScores[table->CurrentPlayer].ScoreStruct) return 0;
		return table->PlayerScores[table->CurrentPlayer].ScoreStruct->Score;
	}
}
#endif
'''
def winmain(text):
    text = text.replace('	ImGui::StyleColorsDark();\n', XP_STYLE, 1)
    text = text.replace('	if (ImGui::BeginMainMenuBar())\n', '	if (!HideMenuBar && ImGui::BeginMainMenuBar())\n', 1)
    text = text.replace('void winmain::RenderUi()\n{', 'static bool HideMenuBar = false;\n\nvoid winmain::RenderUi()\n{', 1)
    text = text.replace('#include "winmain.h"\n', '#include "winmain.h"\n#include "TPinballTable.h"\n#include "score.h"\n', 1)
    return text + EXPORTS
edit(src / 'winmain.cpp', winmain)
edit(src / 'imgui.cpp', sub('    RenderTextClipped(layout_r.Min, layout_r.Max, name, NULL, &text_size, style.WindowTitleAlign, &clip_r);\n}',
    '    PushStyleColor(ImGuiCol_Text, ImVec4(1.0f, 1.0f, 1.0f, 1.0f)); // white on the blue title bar, like Windows XP\n    RenderTextClipped(layout_r.Min, layout_r.Max, name, NULL, &text_size, style.WindowTitleAlign, &clip_r);\n    PopStyleColor();\n}'))

def pb(text):
    text = text.replace('''		for (auto i = 0; i < playerCount; ++i)
		{
			int position = high_score::get_score_position(highscore_table, scores[i]);
			if (position >= 0)
			{
				strncpy(String1, pinball::get_rc_string(scoreIndex[i] + 26, 0), sizeof String1 - 1);
				high_score::show_and_set_high_score_dialog(highscore_table, scores[i], position, String1);
			}
		}''', '''#ifdef __EMSCRIPTEN__
		// The page around the game keeps the high scores (on the server, per user), not this dialog.
		for (auto i = 0; i < playerCount; ++i)
			nk_js_score(scores[i]);
#else
		for (auto i = 0; i < playerCount; ++i)
		{
			int position = high_score::get_score_position(highscore_table, scores[i]);
			if (position >= 0)
			{
				strncpy(String1, pinball::get_rc_string(scoreIndex[i] + 26, 0), sizeof String1 - 1);
				high_score::show_and_set_high_score_dialog(highscore_table, scores[i], position, String1);
			}
		}
#endif''', 1)
    text = text.replace('''void pb::high_scores()
{
	high_score::show_high_score_dialog(highscore_table);
}''', '''void pb::high_scores()
{
#ifdef __EMSCRIPTEN__
	nk_js_show_scores();
#else
	high_score::show_high_score_dialog(highscore_table);
#endif
}''', 1)
    lines = text.split('\n'); last = max(n for n, l in enumerate(lines) if l.startswith('#include'))
    lines.insert(last + 1, '''#ifdef __EMSCRIPTEN__
#include <emscripten.h>
EM_JS(void, nk_js_score, (int score), { if (Module.nkScore) Module.nkScore(score); });
EM_JS(void, nk_js_show_scores, (), { if (Module.nkShowScores) Module.nkShowScores(); });
#endif''')
    return '\n'.join(lines)
edit(src / 'pb.cpp', pb)
print('patched')
