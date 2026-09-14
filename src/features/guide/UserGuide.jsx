import { Button, SectionTitle } from '../../components/common'

export default function UserGuide({ onNavigate }) {
  return <div className="user-guide">
    <section className="panel guide-intro">
      <span className="eyebrow">Start here</span>
      <h2>Your first material comparison</h2>
      <p>Compare how much heat passes through different wall or roof assemblies under the same conditions. The app calculates an hourly conduction cooling load for each assembly, then ranks them by their highest load in the selected period.</p>
      <p>For a first look, keep the sample inputs and select <strong>Run comparison</strong>. The included reference data is synthetic and is intended for learning the workflow. Use verified reference tables and assembly properties for engineering work.</p>
      <div className="action-row"><Button variant="primary" onClick={() => onNavigate('setup')}>Open comparison setup</Button><Button onClick={() => onNavigate('reference')}>Review reference data</Button></div>
    </section>

    <section className="panel">
      <SectionTitle eyebrow="01 / Prepare" title="Set up a fair comparison" />
      <ol className="guide-steps">
        <li><h3>Choose the surface and input units</h3><p>In <strong>Comparison setup</strong>, choose Wall or Roof and enter the surface area. Choose the wall orientation; roofs use Horizontal. Select SI (metric) or IP (imperial) for your inputs. These conditions apply to every assembly.</p></li>
        <li><h3>Set the location, hours, and temperatures</h3><p>Enter the site latitude, design month, and start and end hours. Both endpoints are included, and hours follow your reference table’s time convention. A short period may miss the daily peak.</p><p>Enter the indoor and outdoor design temperatures, daily range, and outdoor average. <strong>Derive outdoor average</strong> calculates outdoor design temperature minus half the daily range only when clicked. Click it again after changing those inputs, or enter your own average.</p></li>
        <li><h3>Choose how to handle negative loads</h3><p><strong>Preserve</strong> keeps negative values, which represent outward heat flow. <strong>Clamp to zero</strong> counts those hours as zero cooling load. The audit retains the raw corrected temperature difference.</p></li>
        <li><h3>Check the reference dataset</h3><p>Open <strong>Reference data</strong> to review or import JSON or CSV tables. Download a template to see the required structure. Select a dataset with the same unit system as your inputs and entries for your groups, surface, orientation, hours, latitude, and month. The app requires matching entries; it does not fill missing values by interpolation.</p></li>
      </ol>
    </section>

    <section className="panel">
      <SectionTitle eyebrow="02 / Assemblies" title="Add the materials you want to compare" />
      <div className="guide-body"><p>In <strong>Materials</strong>, keep at least two assemblies. Select <strong>Add assembly</strong> or click an existing assembly name to edit it. Each entry describes a complete wall or roof assembly.</p>
        <dl className="guide-definitions">
          <div><dt>U-value</dt><dd>How readily heat passes through the assembly. Enter a positive value in the displayed input units. A lower U-value reduces conduction for the same area and corrected temperature difference.</dd></div>
          <div><dt>Reference group</dt><dd>Select the group assigned to the assembly by your reference source. Its hourly profile affects the size and timing of the load; a group letter alone does not define the construction.</dd></div>
          <div><dt>Exterior surface colour</dt><dd>The app applies a colour factor K: 1.00 for dark or 0.65 for light. Advanced custom factors must be greater than zero and no more than 1, and should match your source method.</dd></div>
          <div><dt>Comparison baseline</dt><dd>Select the assembly that other results should be compared with. This controls the reported load and percentage differences.</dd></div>
        </dl>
        <p>Select <strong>Save assembly</strong>, then <strong>Run comparison</strong>. If validation finds an issue, correct the listed inputs or reference entries and run again.</p>
        <Button onClick={() => onNavigate('materials')}>Open materials</Button>
      </div>
    </section>

    <section className="panel">
      <SectionTitle eyebrow="03 / Method" title="How the answer is calculated" />
      <div className="guide-body"><p>CLTD means <strong>Cooling Load Temperature Difference</strong>. For each assembly and hour, the app looks up a base CLTD, adds the latitude/month correction, applies the colour factor, and adds indoor and outdoor temperature corrections.</p>
        <div className="formula-box"><strong>Q = U × Area × corrected CLTD</strong><p>Q is the conduction cooling load. The calculation produces watts with SI inputs or Btu/h with IP inputs, then converts the result to your selected display unit.</p></div>
        <p>For example, U = 0.5 W/m²·K, area = 20 m², and corrected CLTD = 10 K give 100 W, displayed as <strong>0.1 kW</strong>.</p>
        <p>This comparison covers conduction through one opaque surface. It does not calculate a whole building’s cooling load, including windows, ventilation, people, or equipment.</p>
      </div>
    </section>

    <section className="panel">
      <SectionTitle eyebrow="04 / Results" title="Read the load and the timing together" />
      <div className="guide-body">
        <dl className="guide-definitions">
          <div><dt>Result unit</dt><dd>Results open in <strong>kW</strong>. Use the selector to switch to <strong>Tons (refrigeration)</strong> or <strong>Btu/hr</strong>. Charts, load tables, the audit equivalent, and CSV exports follow the selection. One refrigeration ton equals 12,000 Btu/hr (about 3.517 kW). This changes the display, not your input units or ranking.</dd></div>
          <div><dt>Lowest peak and ranked results</dt><dd>Each assembly is ranked by its own highest hourly load in the selected period. Those peaks can occur at different hours. Ties share a rank. Average is the arithmetic mean of the calculated hourly loads.</dd></div>
          <div><dt>Difference from baseline</dt><dd>The difference is the assembly’s peak minus the baseline’s peak. A negative difference means a lower peak. Percentage differences show N/A when the baseline peak is zero.</dd></div>
          <div><dt>Hourly profiles</dt><dd>Compare when loads rise and fall. Use Chart metric to switch between conduction load and corrected CLTD. Click legend entries to hide or show assemblies.</dd></div>
          <div><dt>Selected hour and calculation audit</dt><dd>Choose a Design hour to compare every assembly at the same time. Select Inspect or an assembly name in Ranked results to review its lookup values, corrections, multiplication, and reference source. Complete hourly values provides every calculated row.</dd></div>
        </dl>
        <p>If you edit inputs after calculating, the app marks the results as outdated. Select <strong>Run comparison</strong> again to update the snapshot before using or exporting it.</p>
      </div>
    </section>

    <section className="panel">
      <SectionTitle eyebrow="05 / Keep your work" title="Export results and save a backup" />
      <div className="guide-body"><p>Open <strong>Reports</strong> to download a Summary CSV or Hourly CSV, or select <strong>Print report</strong> to print or save a PDF through your browser. Select the desired result unit before exporting. CSV files retain full numeric precision; screen values are rounded.</p>
        <p>Changes save automatically in this browser. In <strong>Settings</strong>, use <strong>Export project JSON</strong> to keep a backup or move your project to another browser. Use <strong>Import project JSON</strong> to restore it. Clearing browser data removes the local copy.</p>
        <p>Loading the sample, importing a project, or resetting replaces the current project after confirmation. Export your current project first if you want to keep it.</p>
        <div className="action-row"><Button onClick={() => onNavigate('reports')}>Open reports</Button><Button onClick={() => onNavigate('settings')}>Open settings</Button></div>
      </div>
    </section>

    <section className="panel">
      <SectionTitle title="If something does not look right" />
      <div className="guide-body"><dl className="guide-definitions">
        <div><dt>Dataset units must match</dt><dd>Choose a reference dataset in the same SI or IP system as Comparison setup. Switching input units converts project quantities but does not convert the reference tables.</dd></div>
        <div><dt>Missing CLTD or LM entry</dt><dd>Check that the dataset covers the selected group, surface, orientation, hour, latitude, and month. LM is the latitude/month correction. Import the required verified entries or choose a scenario covered by your dataset.</dd></div>
        <div><dt>Identical or unexpected results</dt><dd>Check each assembly’s U-value, group, colour factor, and the selected time period. Assemblies with identical calculation properties produce identical loads. Use the audit to trace an unexpected value.</dd></div>
      </dl></div>
    </section>
  </div>
}
