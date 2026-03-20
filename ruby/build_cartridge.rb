#!/usr/bin/env ruby
# frozen_string_literal: true

# Reads JSON spec from stdin, writes a Canvas Common Cartridge (.imscc) via canvas_cc gem.
# Prints one JSON line to stdout: {"imscc_path":"...","filename":"..."} or {"error":"..."}

require "json"
require "fileutils"

require "canvas_cc"

M = CanvasCc::CanvasCC::Models

def fail!(msg)
  warn({ error: msg }.to_json)
  exit 1
end

def build_from_spec(spec)
  out_dir = spec["output_directory"]
  fail!("output_directory required") if out_dir.nil? || out_dir.to_s.strip.empty?

  FileUtils.mkdir_p(out_dir)

  cspec = spec["course"] || {}
  fail!("course.title required") if cspec["title"].to_s.empty?

  course = M::Course.new
  course.grading_standards ||= []

  cid = cspec["identifier"].to_s
  course.identifier = cid unless cid.empty?

  course.title = cspec["title"]
  course.course_code = cspec["course_code"] if cspec["course_code"]
  course.workflow_state = cspec["workflow_state"] if cspec["workflow_state"]
  course.start_at = cspec["start_at"] if cspec["start_at"]
  course.conclude_at = cspec["conclude_at"] if cspec["conclude_at"]

  (spec["assignment_groups"] || []).each do |g|
    ag = M::AssignmentGroup.new
    ag.identifier = g["identifier"]
    ag.title = g["title"]
    ag.position = g["position"] if g.key?("position")
    ag.group_weight = g["group_weight"] if g.key?("group_weight")
    (g["rules"] || []).each { |r| ag.rules << r.transform_keys(&:to_sym) }
    course.assignment_groups << ag
  end

  (spec["pages"] || []).each do |p|
    page = M::Page.new
    page.identifier = p["identifier"]
    page.page_name = p["page_name"] || p["title"] || "untitled"
    page.body = p["body"] || ""
    page.workflow_state = p["workflow_state"] if p["workflow_state"]
    course.pages << page
  end

  (spec["assignments"] || []).each do |a|
    as = M::Assignment.new
    as.identifier = a["identifier"]
    as.title = a["title"]
    as.body = a["body"] || ""
    as.points_possible = a["points_possible"] if a.key?("points_possible")
    as.workflow_state = a["workflow_state"] if a["workflow_state"]
    as.grading_type = a["grading_type"] if a["grading_type"]
    as.due_at = a["due_at"] if a["due_at"]
    as.unlock_at = a["unlock_at"] if a["unlock_at"]
    as.lock_at = a["lock_at"] if a["lock_at"]
    if a["assignment_group_identifier_ref"]
      as.assignment_group_identifier_ref = a["assignment_group_identifier_ref"]
    end
    (a["submission_types"] || []).each { |st| as.submission_types << st }
    course.assignments << as
  end

  (spec["discussions"] || []).each do |d|
    disc = M::Discussion.new
    disc.identifier = d["identifier"]
    disc.title = d["title"]
    disc.text = d["text"] || ""
    disc.discussion_type = d["discussion_type"] if d["discussion_type"]
    disc.workflow_state = d["workflow_state"] if d["workflow_state"]
    disc.require_initial_post = d["require_initial_post"] unless d["require_initial_post"].nil?
    disc.position = d["position"] if d["position"]
    course.discussions << disc
  end

  (spec["folders"] || []).each do |f|
    folder = M::CanvasFolder.new
    folder.folder_location = f["folder_location"]
    folder.hidden = f["hidden"] unless f["hidden"].nil?
    folder.locked = f["locked"] unless f["locked"].nil?
    course.folders << folder
  end

  (spec["files"] || []).each do |f|
    cf = M::CanvasFile.new
    cf.identifier = f["identifier"]
    cf.file_path = f["file_path"]
    cf.file_location = f["file_location"]
    cf.hidden = f["hidden"] unless f["hidden"].nil?
    cf.usage_rights = f["usage_rights"] if f["usage_rights"]
    course.files << cf
  end

  (spec["canvas_modules"] || []).each do |m|
    mod = M::CanvasModule.new
    mod.identifier = m["identifier"]
    mod.title = m["title"]
    mod.workflow_state = m["workflow_state"] if m["workflow_state"]
    mod.unlock_at = m["unlock_at"] if m["unlock_at"]

    (m["module_items"] || []).each do |mi|
      item = M::ModuleItem.new
      item.identifier = mi["identifier"]
      item.title = mi["title"]
      item.content_type = mi["content_type"]
      item.workflow_state = mi["workflow_state"] if mi["workflow_state"]
      item.identifierref = mi["identifierref"] if mi["identifierref"]
      item.url = mi["url"] if mi["url"]
      item.new_tab = mi["new_tab"] unless mi["new_tab"].nil?
      item.indent = mi["indent"] if mi["indent"]
      mod.module_items << item
    end

    course.canvas_modules << mod
  end

  course.resolve_question_references! if course.assessments.any? && course.question_banks.any?

  imscc_path = CanvasCc::CanvasCC::CartridgeCreator.new(course).create(out_dir)
  filename = File.basename(imscc_path)
  { imscc_path: imscc_path, filename: filename }
end

begin
  raw = $stdin.read
  spec = JSON.parse(raw)
  result = build_from_spec(spec)
  puts JSON.generate(result)
rescue JSON::ParserError => e
  fail!("Invalid JSON: #{e.message}")
rescue StandardError => e
  fail!("#{e.class}: #{e.message}")
end
