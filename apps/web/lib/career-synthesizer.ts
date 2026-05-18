import { supabase } from './supabase';

export interface SynthesizedSignal {
    text: string;
    sources: string[];
    isFallback: boolean;
}

export const CareerSynthesizer = {
    /**
     * Fuses Profile Snapshots and Resume History into a single source of truth.
     */
    async synthesizeCareerContext(userId: string): Promise<SynthesizedSignal> {
        const sources: string[] = [];
        let combinedText = "";

        // 1. Fetch Latest Profile Snapshot (The High-Fidelity Ground Truth)
        const { data: snapshot } = await supabase
            .from('profile_snapshots')
            .select('snapshot_data, created_at')
            .eq('user_id', userId)
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (snapshot?.snapshot_data) {
            sources.push('PROFILE_SNAPSHOT');
            combinedText += this.formatSnapshotToText(snapshot.snapshot_data);
        }

        // 2. Fetch Recent Resume History (Contextual Phrasing)
        const { data: resumes } = await supabase
            .from('resumes')
            .select('*, resume_versions(*)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (resumes && resumes.length > 0) {
            sources.push('RESUME_HISTORY');
            combinedText += "\n\n--- HISTORICAL RESUME CONTEXT ---\n";
            resumes.forEach(r => {
                const version = r.resume_versions?.find((v: any) => v.version_type === 'original') || r.resume_versions?.[0];
                if (version?.data) {
                    combinedText += `\n[Source: ${r.name}]\n`;
                    combinedText += this.formatResumeDataToText(version.data);
                }
            });
        }

        return {
            text: combinedText,
            sources,
            isFallback: !resumes?.length
        };
    },

    formatSnapshotToText(data: any): string {
        let text = "--- CANONICAL PROFILE SNAPSHOT ---\n";

        if (data.work_history) {
            text += "\n[WORK HISTORY]\n";
            data.work_history.forEach((w: any) => {
                text += `- ${w.title} at ${w.company} (${w.start_date} - ${w.end_date || 'Present'})\n`;
                if (w.description) text += `  Description: ${w.description}\n`;
            });
        }

        if (data.skills) {
            text += "\n[SKILLS]\n";
            text += data.skills.map((s: any) => `${s.name} (${s.proficiency?.level || 'Intermediate'})`).join(', ') + "\n";
        }

        if (data.projects) {
            text += "\n[PROJECTS]\n";
            data.projects.forEach((p: any) => {
                text += `- ${p.name}: ${p.description}\n`;
            });
        }

        return text;
    },

    formatResumeDataToText(data: any): string {
        const contact = data.contact || {};
        const summary = data.summary || "";
        const exp = (data.experience || []).map((e: any) =>
            `${e.title} at ${e.organization} (${e.dates}): ${e.bullets?.join(' ')}`
        ).join('\n');

        return `${contact.full_name || ''} Summary: ${summary}\nExperience:\n${exp}`;
    }
};
