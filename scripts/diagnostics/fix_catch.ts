const filePathAts = 'supabase/functions/ats-engine-ultimate/index.ts';
const filePathHealth = 'supabase/functions/ingest-company-health/index.ts';

async function fixAtsEngine() {
    let content = await Deno.readTextFile(filePathAts);
    
    // Replace silent empty array catch blocks
    content = content.replace(/} catch \{ return \[\]; \}/g, '} catch (e) { throw e; }');
    // Replace silent catch blocks with console.error and return [] (YC and Builtin)
    content = content.replace(/} catch \(e\) \{ console\.error\("\[(.*?)\] Error:", e\); return \[\]; \}/g, '} catch (e) { throw e; }');
    content = content.replace(/} catch \(e\) \{ console\.error\("\[(.*?)\] Error:", e\); \}/g, '} catch (e) { throw e; }');
    
    // Fix the catch block of the main worker to log to pipeline_failures
    const outerCatch = `    } catch (e: any) {
        console.error(\`[ULTIMATE] Fatal: \${e.message}\`);
        await supabase.from('pipeline_failures').insert({ stage: 'runtime', worker_name: 'ats-engine-ultimate', error_message: e.message, metadata: { error: e.stack } });
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: corsHeaders });
    }`;
    content = content.replace(/    \} catch \(e: any\) \{\n        console\.error\(`\[ULTIMATE\] Fatal: \$\{e\.message\}`\);\n        return new Response[^\n]*\n    \}/g, outerCatch);

    // Also update the provider catch block to log to pipeline_failures
    const providerCatch = `            } catch (err: any) {
                const is429 = err.message.includes('429') || err.message.toLowerCase().includes('too many requests') || err.message.includes('403');
                if (is429) {
                    console.error(\`[CIRCUIT BREAKER] 429/403 detected for \${provider}. Quarantining.\`);
                    await supabase.from('source_reliability').upsert({
                        source_name: provider,
                        status: 'QUARANTINE',
                        retry_after: new Date(Date.now() + 3600000).toISOString(),
                        reliability_score: 0.1,
                        last_error: err.message
                    }, { onConflict: 'source_name' });

                    await supabase.from('integrity_events').insert({
                        event_type: 'SOURCE_QUARANTINE',
                        source: provider,
                        message: \`Source \${provider} quarantined due to 429/403.\`,
                        metadata: { error: err.message, request_id: requestId }
                    });
                    
                    await supabase.from('pipeline_failures').insert({
                        stage: 'connector_fetch', worker_name: 'ats-engine-ultimate', error_message: '429/403 Quarantined',
                        error_code: 'RATE_LIMIT', metadata: { provider, error: err.message }
                    });
                    break;
                }
                console.error(\`[ULTIMATE] Failure for \${provider}/\${kw}: \${err.message}\`);
                await supabase.from('integrity_events').insert({
                    event_type: 'SOURCE_FETCH_FAILURE',
                    source: provider,
                    message: \`Failed to fetch \${kw} from \${provider}: \${err.message}\`,
                    metadata: { error: err.message, keyword: kw, request_id: requestId }
                });
                await supabase.from('pipeline_failures').insert({
                    stage: 'connector_fetch', worker_name: 'ats-engine-ultimate', error_message: err.message,
                    error_code: 'FETCH_ERROR', metadata: { provider, keyword: kw }
                });
            }`;
    content = content.replace(/            \} catch \(err: any\) \{[\s\S]*?request_id: requestId \}\);\n            \}/, providerCatch);

    await Deno.writeTextFile(filePathAts, content);
}

async function fixCompanyHealth() {
    let content = await Deno.readTextFile(filePathHealth);
    
    const badCatch = `} catch (e: any) { console.warn('[INGEST-COMPANY] Gemini parsing failed:', e.message); }`;
    const goodCatch = `} catch (e: any) { 
            console.warn('[INGEST-COMPANY] Gemini parsing failed:', e.message); 
            await supabase.from('pipeline_failures').insert({
                stage: 'gemini_parse', worker_name: 'ingest-company-health', error_message: e.message,
                error_code: 'AI_FAILURE', metadata: { error: e.stack }
            });
        }`;
    content = content.replace(badCatch, goodCatch);

    const outerCatch = `    } catch (err: any) { return errResp(err.message); }`;
    const goodOuterCatch = `    } catch (err: any) { 
        await supabase.from('pipeline_failures').insert({
            stage: 'runtime', worker_name: 'ingest-company-health', error_message: err.message,
            error_code: 'FATAL_ERROR', metadata: { error: err.stack }
        });
        return errResp(err.message); 
    }`;
    content = content.replace(outerCatch, goodOuterCatch);
    
    await Deno.writeTextFile(filePathHealth, content);
}

await fixAtsEngine();
await fixCompanyHealth();
console.log('Fixed silent catches');
