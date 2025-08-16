import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { createBiorxivApiClient, getServerFromDOI } from '../api/biorxiv-api.js';
import { parseBiorxivURL } from 'biorxiv-utils';

export const summaryCommand = new Command('summary')
  .description('Get a summary of a bioRxiv preprint from a URL or DOI')
  .argument('<url-or-doi>', 'bioRxiv URL or DOI to summarize')
  .option('-m, --more', 'Show additional details and full abstract')
  .option('-s, --server <server>', 'Specify server (biorxiv or medrxiv)')
  .action(async (urlOrDoi: string, options: any) => {
    try {
      console.log(chalk.blue.bold('🔬 BioRxiv Preprint Summary'));
      console.log(chalk.blue('================================\n'));

      // Parse the input (could be URL or DOI)
      let doi: string;
      let parsedUrl: any = null;

      if (
        urlOrDoi.includes('biorxiv.org') ||
        urlOrDoi.includes('medrxiv.org') ||
        urlOrDoi.includes('doi.org')
      ) {
        // It's a URL
        parsedUrl = parseBiorxivURL(urlOrDoi);
        if (!parsedUrl) {
          console.log(chalk.red('❌ Invalid bioRxiv URL'));
          process.exit(1);
        }
        doi = parsedUrl.doi;
        console.log(chalk.cyan(`📝 URL: ${urlOrDoi}`));
      } else {
        // It's a DOI
        doi = urlOrDoi;
        console.log(chalk.cyan(`🔍 DOI: ${doi}`));
      }

      console.log('');

      // Determine server if possible
      let server = options.server ?? getServerFromDOI(urlOrDoi);

      console.log(chalk.blue(`🌐 Server: ${server}`));
      console.log('');

      // Create API client
      const apiClient = createBiorxivApiClient({
        server,
        format: 'json',
        timeout: 15000,
      });

      // Show loading indicator
      console.log(chalk.yellow('⏳ Fetching preprint information...'));
      console.log('');

      // Get content details
      let contentDetail = await apiClient.getContentDetail(doi);
      let fallbackServer: 'biorxiv' | 'medrxiv' | null = null;

      // If not found on bioRxiv and we're not already on medrxiv, try medrxiv as fallback
      if (!contentDetail && server === 'biorxiv') {
        console.log(chalk.yellow('⚠️  Paper not found on bioRxiv, trying medRxiv...'));
        fallbackServer = 'medrxiv';

        const medrxivApiClient = createBiorxivApiClient({
          server: 'medrxiv',
          format: 'json',
          timeout: 15000,
        });

        contentDetail = await medrxivApiClient.getContentDetail(doi);

        if (contentDetail) {
          console.log(chalk.green('✅ Found paper on medRxiv!'));
          server = 'medrxiv'; // Update server for display
          contentDetail.server = 'medrxiv'; // Ensure the content detail has the correct server
        }
      }

      if (!contentDetail) {
        console.log(chalk.red('❌ No content found for this DOI on either bioRxiv or medRxiv'));
        console.log(chalk.yellow("💡 This might be a new preprint that hasn't been indexed yet"));
        process.exit(1);
      }

      // Get all versions
      let allVersions = await apiClient.getAllVersions(doi);

      // If we used fallback, get versions from the fallback server
      if (fallbackServer && contentDetail) {
        const fallbackApiClient = createBiorxivApiClient({
          server: fallbackServer,
          format: 'json',
          timeout: 15000,
        });
        allVersions = await fallbackApiClient.getAllVersions(doi);
      }

      // Display summary
      const isVerbose = options.more === true;
      displaySummary(contentDetail, allVersions, isVerbose);
    } catch (error) {
      console.error(
        chalk.red('❌ Error:'),
        error instanceof Error ? error.message : 'Unknown error',
      );
      process.exit(1);
    }
  });

function displaySummary(contentDetail: any, allVersions: any[], verbose: boolean = false) {
  // Title in a prominent box
  const titleBox = boxen(chalk.green.bold.underline(contentDetail.title), {
    padding: 1,
    margin: 1,
    borderStyle: 'double',
    borderColor: 'green',
    backgroundColor: 'black',
    textAlignment: 'left',
    ...(verbose ? {} : { width: 80 }),
  });
  console.log(titleBox);

  // Basic info
  const basicInfo = [
    `${chalk.cyan('DOI:')} ${contentDetail.doi}`,
    `${chalk.cyan('Server:')} ${contentDetail.server}`,
    `${chalk.cyan('Category:')} ${chalk.yellow(contentDetail.category)}`,
    `${chalk.cyan('License:')} ${chalk.yellow(contentDetail.license)}`,
    `${chalk.cyan('Type:')} ${chalk.yellow(contentDetail.type)}`,
    `${chalk.cyan('Published:')} ${
      contentDetail.published === 'NA'
        ? chalk.gray('Not published')
        : chalk.green(contentDetail.published)
    }`,
    `${chalk.cyan('Total versions:')} ${allVersions ? allVersions.length : 0}`,
    ...(verbose
      ? [
          `${chalk.cyan('Date:')} ${contentDetail.date}`,
          `${chalk.cyan('Version:')} ${contentDetail.version}`,
          ...(contentDetail.jatsxml
            ? [`${chalk.cyan('JATS XML:')} ${chalk.underline.blue(contentDetail.jatsxml)}`]
            : []),
        ]
      : []),
  ].join('\n');

  const basicInfoBox = boxen(basicInfo, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'blue',
    title: chalk.blue.bold('📋 Basic Information'),
    titleAlignment: 'left',
    textAlignment: 'left',
    ...(verbose ? {} : { width: 80 }),
  });
  console.log(basicInfoBox);

  // Authors
  const authorsInfo = [
    `${chalk.cyan('Authors:')} ${contentDetail.authors}`,
    ...(contentDetail.author_corresponding
      ? [`${chalk.cyan('Corresponding:')} ${chalk.green(contentDetail.author_corresponding)}`]
      : []),
    ...(contentDetail.author_corresponding_institution
      ? [
          `${chalk.cyan('Institution:')} ${chalk.gray(contentDetail.author_corresponding_institution)}`,
        ]
      : []),
  ].join('\n');

  const authorsBox = boxen(authorsInfo, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'cyan',
    title: chalk.cyan.bold('👥 Authors'),
    titleAlignment: 'left',
    textAlignment: 'left',
    ...(verbose ? {} : { width: 80 }),
  });
  console.log(authorsBox);

  // Abstract
  if (contentDetail.abstract) {
    const abstractBox = boxen(contentDetail.abstract, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'yellow',
      title: chalk.yellow.bold('📖 Abstract'),
      titleAlignment: 'left',
      textAlignment: 'left',
      ...(verbose ? {} : { width: 80 }),
    });
    console.log(abstractBox);
  }

  // Funding information
  if (contentDetail.funding && contentDetail.funding.length > 0) {
    const fundingInfo = contentDetail.funding
      .map((fund: any, index: number) => {
        let fundText = `${chalk.cyan(index + 1)}. ${chalk.green(fund.name)}`;
        if (fund.id) {
          fundText += `\n   ${chalk.gray('ID:')} ${fund.id} (${fund['id-type']})`;
        }
        if (fund.award) {
          fundText += `\n   ${chalk.gray('Award:')} ${fund.award}`;
        }
        return fundText;
      })
      .join('\n\n');

    const fundingBox = boxen(fundingInfo, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'magenta',
      title: chalk.magenta.bold('💰 Funding'),
      titleAlignment: 'left',
      textAlignment: 'left',
      ...(verbose ? {} : { width: 80 }),
    });
    console.log(fundingBox);
  }

  // Versions - only show when --more is provided
  if (verbose && allVersions && allVersions.length > 0) {
    const versionsInfo = [
      ...allVersions.map((version: any, index: number) => {
        let versionText = `${chalk.cyan(`v${version.version}`)} (${version.date})`;
        versionText += `\n   ${chalk.gray('Type:')} ${version.type}`;
        versionText += `\n   ${chalk.gray('Title:')} ${version.title.substring(0, 60)}...`;

        if (version.jatsxml) {
          versionText += `\n   ${chalk.gray('JATS XML:')} ${chalk.underline.blue(version.jatsxml)}`;
        }
        return versionText;
      }),
    ].join('\n\n');

    const versionsBox = boxen(versionsInfo, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'green',
      title: chalk.green.bold('🔄 Versions'),
      titleAlignment: 'left',
      textAlignment: 'left',
      ...(verbose ? {} : { width: 80 }),
    });
    console.log(versionsBox);
  }

  // Footer
  const baseUrl =
    contentDetail.server === 'medrxiv'
      ? `https://www.medrxiv.org/content/${contentDetail.doi}`
      : `https://www.biorxiv.org/content/${contentDetail.doi}`;

  const footerInfo = [
    `💡 View online: ${chalk.underline.blue(baseUrl)}`,
    ...(allVersions && allVersions.length > 1 && !verbose
      ? [
          `📚 This preprint has ${allVersions.length} versions. Use --more to see additional details.`,
        ]
      : []),
  ].join('\n');

  const footerBox = boxen(footerInfo, {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'gray',
    backgroundColor: 'black',
    textAlignment: 'left',
    ...(verbose ? {} : { width: 80 }),
  });
  console.log(footerBox);
}
