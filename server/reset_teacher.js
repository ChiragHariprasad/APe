import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: dbUrl,
});

async function resetTeacher() {
  const email = 'chiragh.ai24@rvce.edu.in';
  console.log(`Searching for user with email: ${email}`);

  try {
    const userRes = await pool.query(`SELECT * FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
    if (userRes.rows.length === 0) {
      console.log(`No user found with email matching: ${email}`);
      const allUsers = await pool.query(`SELECT * FROM users LIMIT 10`);
      console.log('Sample users in DB:', allUsers.rows);
      await pool.end();
      return;
    }

    const user = userRes.rows[0];
    console.log(`Found user:`, user);

    // Find teacher profile
    const profileRes = await pool.query(`SELECT id FROM teacher_profiles WHERE user_id = $1`, [user.id]);
    if (profileRes.rows.length === 0) {
      console.log(`No teacher profile found for user ID: ${user.id}`);
    } else {
      const teacherProfileId = profileRes.rows[0].id;
      console.log(`Found teacher profile ID: ${teacherProfileId}`);

      // Count associated records before deletion
      const coursesRes = await pool.query(`SELECT id FROM teacher_course_profiles WHERE teacher_id = $1`, [teacherProfileId]);
      console.log(`Found ${coursesRes.rows.length} teacher course profiles.`);

      const tcIds = coursesRes.rows.map(r => r.id);
      if (tcIds.length > 0) {
        const turnsRes = await pool.query(`SELECT COUNT(*) FROM teacher_interview_turns WHERE teacher_course_id = ANY($1)`, [tcIds]);
        console.log(`Found ${turnsRes.rows[0].count} interview turns.`);

        const probesRes = await pool.query(`SELECT COUNT(*) FROM teacher_mismatch_probes WHERE teacher_course_id = ANY($1)`, [tcIds]);
        console.log(`Found ${probesRes.rows[0].count} mismatch probes.`);

        const evalsRes = await pool.query(`SELECT COUNT(*) FROM teacher_post_evaluations WHERE teacher_course_id = ANY($1)`, [tcIds]);
        console.log(`Found ${evalsRes.rows[0].count} post-evaluations.`);
      }

      // Delete teacher profile (will cascade to all course profiles, turns, probes, post-evaluations)
      await pool.query(`DELETE FROM teacher_profiles WHERE id = $1`, [teacherProfileId]);
      console.log(`Successfully deleted teacher profile and all associated survey/interview details for ${email}!`);
    }

    console.log(`\nUser ${email} has been completely reset for a fresh start.`);
  } catch (err) {
    console.error('Error during teacher reset:', err);
  } finally {
    await pool.end();
  }
}

resetTeacher();
