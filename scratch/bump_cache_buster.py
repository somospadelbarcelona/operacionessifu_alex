with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

v_old_cmh = '<script src="cmh_bcn_data.js?v=2.0"></script>'
v_new_cmh = '<script src="cmh_bcn_data.js?v=20261105_v11_clean_indra"></script>'

v_old_contr = '<script src="fichajes_contraste_data.js?v=5.0"></script>'
v_new_contr = '<script src="fichajes_contraste_data.js?v=20261105_v11_clean_indra"></script>'

v_old_ent = '<script src="enterprise_platform.js?v=20261105_v10_export_fix"></script>'
v_new_ent = '<script src="enterprise_platform.js?v=20261105_v11_clean_indra"></script>'

if v_old_cmh in html: html = html.replace(v_old_cmh, v_new_cmh)
if v_old_contr in html: html = html.replace(v_old_contr, v_new_contr)
if v_old_ent in html: html = html.replace(v_old_ent, v_new_ent)

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)

print("index.html cache buster updated successfully.")
