import { useState } from "react";
import { download, request, useQuery } from "./api";
import { Field, Form, label, Load, Panel, Select, TextArea, value } from "./ui";
import type { Academic, Department } from "./types";

interface Profile {
  fullName: string;
  phone?: string;
  academic?: Academic;
  skills: { skill: { name: string } }[];
  certifications: { name: string; issuer: string }[];
  projects: { name: string; description: string }[];
}
interface Resume {
  id: string;
  filename: string;
  size: number;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
}

function pairs(text: string, right: "issuer" | "description") {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const delimiter = line.indexOf("|");
      if (delimiter < 0)
        throw new Error("Use a vertical bar to separate each name from its details.");
      return { name: line.slice(0, delimiter).trim(), [right]: line.slice(delimiter + 1).trim() };
    });
}

export function StudentProfile({ scope }: { scope: string }) {
  const data = useQuery<{ profile: Profile | null; completeness: number }>(scope + "/students/me");
  const departments = useQuery<Department[]>(scope + "/departments");
  const profile = data.data?.profile;
  const academic = profile?.academic;
  return (
    <Load state={data}>
      <Panel title="Personal information">
        <p>Profile completeness {data.data?.completeness ?? 0}%</p>
        <Form
          submit="Save profile"
          onSubmit={async (fields) => {
            await request(scope + "/students/me", "PUT", {
              fullName: value(fields, "fullName"),
              phone: value(fields, "phone") || null,
              skills: value(fields, "skills")
                .split(",")
                .map((entry) => entry.trim())
                .filter(Boolean),
              certifications: pairs(value(fields, "certifications"), "issuer"),
              projects: pairs(value(fields, "projects"), "description"),
            });
            data.refresh();
          }}
        >
          <div className="workspace-grid">
            <Field
              label="Full name"
              name="fullName"
              defaultValue={profile?.fullName}
              autoComplete="name"
              maxLength={120}
              required
            />
            <Field
              label="Phone (optional)"
              name="phone"
              type="tel"
              defaultValue={profile?.phone}
              autoComplete="tel"
              maxLength={30}
            />
          </div>
          <TextArea
            label="Technical skills (comma-separated)"
            name="skills"
            defaultValue={profile?.skills.map(({ skill }) => skill.name).join(", ")}
          />
          <TextArea
            label="Certifications (one Name | Issuer per line)"
            name="certifications"
            defaultValue={profile?.certifications
              .map((entry) => `${entry.name} | ${entry.issuer}`)
              .join("\n")}
          />
          <TextArea
            label="Projects (one Name | Description per line)"
            name="projects"
            defaultValue={profile?.projects
              .map((entry) => `${entry.name} | ${entry.description}`)
              .join("\n")}
          />
        </Form>
      </Panel>
      <Panel title="Academic details">
        {!profile ? (
          <p>Save your personal information before submitting academic details.</p>
        ) : (
          <Load state={departments}>
            <p>
              Verification status:{" "}
              <strong>{academic ? label(academic.status) : "Not submitted"}</strong>
            </p>
            {academic && <p>Department: {academic.program.department.name}</p>}
            <p>Changes to academic facts send the record back for review.</p>
            {departments.data?.some((department) => department.programs.length) ? (
              <Form
                submit="Submit academic details"
                key={academic?.revision ?? 0}
                onSubmit={async (fields) => {
                  await request(scope + "/students/me/academic", "PUT", {
                    programId: value(fields, "programId"),
                    graduationYear: Number(value(fields, "year")),
                    cgpa: Number(value(fields, "cgpa")),
                    activeBacklogs: Number(value(fields, "backlogs")),
                  });
                  data.refresh();
                }}
              >
                <Select
                  label="Degree program by department"
                  name="programId"
                  defaultValue={academic?.programId ?? ""}
                  required
                >
                  <option value="" disabled>
                    Select a degree program
                  </option>
                  {departments.data?.map((department) => (
                    <optgroup key={department.id} label={department.name}>
                      {department.programs.map((program) => (
                        <option key={program.id} value={program.id}>
                          {program.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
                <div className="workspace-grid">
                  <Field
                    label="Graduation year"
                    name="year"
                    type="number"
                    min={1900}
                    max={new Date().getFullYear() + 15}
                    defaultValue={academic?.graduationYear}
                    required
                  />
                  <Field
                    label="CGPA (out of 10)"
                    name="cgpa"
                    type="number"
                    min={0}
                    max={10}
                    step="0.01"
                    defaultValue={academic?.cgpa}
                    required
                  />
                  <Field
                    label="Active backlogs"
                    name="backlogs"
                    type="number"
                    min={0}
                    max={200}
                    defaultValue={academic?.activeBacklogs ?? 0}
                    required
                  />
                </div>
              </Form>
            ) : (
              <p>No degree programs have been added by your placement office.</p>
            )}
          </Load>
        )}
      </Panel>
    </Load>
  );
}

export function Resumes({ scope }: { scope: string }) {
  const profile = useQuery<{ profile: Profile | null }>(scope + "/students/me");
  return (
    <Load state={profile}>
      {profile.data?.profile ? (
        <ResumeVersions scope={scope} />
      ) : (
        <Panel title="Resume versions">
          <p>Save your student profile before uploading a resume.</p>
        </Panel>
      )}
    </Load>
  );
}

function ResumeVersions({ scope }: { scope: string }) {
  const data = useQuery<Resume[]>(scope + "/resumes");
  const [deleteId, setDeleteId] = useState<string>();
  return (
    <>
      <Panel title="Upload a resume">
        <p>
          PDF or DOCX, up to 5 MiB. Uploads are private and only you can download them in this
          phase.
        </p>
        <Form
          submit="Upload resume"
          success="Resume uploaded."
          onSubmit={async (fields) => {
            await request(scope + "/resumes", "POST", fields);
            data.refresh();
          }}
        >
          <Field label="Resume file" name="resume" type="file" accept=".pdf,.docx" required />
        </Form>
      </Panel>
      <Panel title="Version history">
        <Load state={data}>
          {!data.data?.length ? (
            <p>No resumes uploaded yet.</p>
          ) : (
            <ul className="workspace-list">
              {data.data.map((resume) => (
                <li key={resume.id}>
                  <strong>{resume.filename}</strong>
                  <p>
                    {label(resume.status)} · {Math.ceil(resume.size / 1024)} KiB ·{" "}
                    {new Date(resume.createdAt).toLocaleDateString()}
                  </p>
                  <div className="workspace-actions">
                    <Form
                      submit="Download"
                      success=""
                      onSubmit={() =>
                        download(`${scope}/resumes/${resume.id}/download`, resume.filename)
                      }
                    />
                    <Form
                      submit={resume.status === "ACTIVE" ? "Archive" : "Activate"}
                      onSubmit={async () => {
                        await request(`${scope}/resumes/${resume.id}`, "PATCH", {
                          status: resume.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE",
                        });
                        data.refresh();
                      }}
                    />
                    {deleteId !== resume.id ? (
                      <button
                        className="workspace-secondary"
                        onClick={() => setDeleteId(resume.id)}
                      >
                        Delete
                      </button>
                    ) : (
                      <Form
                        submit="Confirm deletion"
                        onSubmit={async () => {
                          await request(`${scope}/resumes/${resume.id}`, "DELETE");
                          setDeleteId(undefined);
                          data.refresh();
                        }}
                      >
                        <p>
                          This version will be removed from downloads.{" "}
                          <button
                            type="button"
                            className="workspace-secondary"
                            onClick={() => setDeleteId(undefined)}
                          >
                            Cancel
                          </button>
                        </p>
                      </Form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Load>
      </Panel>
    </>
  );
}
