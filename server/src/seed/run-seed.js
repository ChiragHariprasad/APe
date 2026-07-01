/**
 * Seed script for pedagogies and subjects.
 * Reads from the JSON source files and inserts into PostgreSQL.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runSeed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // --------------------------------------------------------
    // 1. Seed pedagogies from pedogogy_questions.json
    // --------------------------------------------------------
    const pedagogiesPath = path.resolve(__dirname, '../../../pedogogy_questions.json');
    const pedagogies = JSON.parse(fs.readFileSync(pedagogiesPath, 'utf-8'));

    console.log('Seeding pedagogies...');
    for (const [id, data] of Object.entries(pedagogies)) {
      await pool.query(
        `INSERT INTO pedagogies (id, name, success_criterion, questions)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           success_criterion = EXCLUDED.success_criterion,
           questions = EXCLUDED.questions`,
        [id, data.name, data.success_criterion, JSON.stringify(data.questions)]
      );
      console.log(`  Pedagogy ${id}: ${data.name}`);
    }
    console.log(`Seeded ${Object.keys(pedagogies).length} pedagogies.`);

    // --------------------------------------------------------
    // 2. Seed subjects from course_knowledge.json
    // --------------------------------------------------------
    const coursesPath = path.resolve(__dirname, '../../../course_knowledge.json');
    const courses = JSON.parse(fs.readFileSync(coursesPath, 'utf-8'));

    console.log('\nSeeding subjects...');
    let subjectCount = 0;

    for (const [batchYear, semesters] of Object.entries(courses)) {
      if (batchYear === 'labs') continue; // handle separately

      for (const [semKey, subjects] of Object.entries(semesters)) {
        const semNum = parseInt(semKey.split('_')[1], 10);

        for (const [code, data] of Object.entries(subjects)) {
          await pool.query(
            `INSERT INTO subjects (subject_code, subject_name, faculty, pedagogy_id, batch_year, semester_key, semester_number, is_lab)
             VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
             ON CONFLICT (subject_code, batch_year, semester_key, is_lab) DO UPDATE SET
               subject_name = EXCLUDED.subject_name,
               faculty = EXCLUDED.faculty,
               pedagogy_id = EXCLUDED.pedagogy_id`,
            [code, data.subject, JSON.stringify(data.faculty), data.pedagogy, parseInt(batchYear, 10), semKey, semNum]
          );
          subjectCount++;
          console.log(`  [${batchYear}/${semKey}] ${code}: ${data.subject}`);
        }
      }
    }

    // Seed labs
    if (courses.labs) {
      console.log('\nSeeding labs...');
      for (const [code, data] of Object.entries(courses.labs)) {
        await pool.query(
          `INSERT INTO subjects (subject_code, subject_name, faculty, pedagogy_id, batch_year, semester_key, semester_number, is_lab)
           VALUES ($1, $2, $3, $4, 0, 'lab', 0, TRUE)
           ON CONFLICT (subject_code, batch_year, semester_key, is_lab) DO UPDATE SET
             subject_name = EXCLUDED.subject_name,
             faculty = EXCLUDED.faculty,
             pedagogy_id = EXCLUDED.pedagogy_id`,
          [code, data.subject, JSON.stringify(data.faculty), data.pedagogy]
        );
        subjectCount++;
        console.log(`  [lab] ${code}: ${data.subject}`);
      }
    }

    console.log(`\nSeeded ${subjectCount} subjects total.`);
    console.log('\nSeed completed successfully!');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSeed();
